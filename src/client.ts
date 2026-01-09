/**
 * Firestore REST Client
 *
 * Main client implementation for Firestore REST API with transaction support.
 */

import { getFirestoreToken } from "./auth.js";
import {
    CollectionReference,
    DocumentReference,
    type FirestoreClientInterface,
} from "./references.js";
import { Transaction } from "./transaction.js";
import type {
    Aggregation,
    AggregationResult,
    AuthConfig,
    BeginTransactionResponse,
    CommitResponse,
    FirestoreDocument,
    RunQueryResponseItem,
    StructuredQuery,
    TransactionOptions,
    Write,
    WriteResult,
} from "./types.js";
import { buildUpdateFields, getFieldPaths } from "./utils.js";
import {
    extractDeleteFields,
    extractFieldTransforms,
    extractTransformFields,
    isFieldValue,
    toFirestoreFields,
    toFirestoreValue,
} from "./value.js";

const API_BASE = "https://firestore.googleapis.com/v1";
const DEFAULT_DATABASE = "(default)";

/**
 * Firestore REST API client.
 */
export class Firestore implements FirestoreClientInterface {
    private readonly _config: AuthConfig;
    private readonly _databaseId: string;
    private _token: string | null = null;
    private _tokenExpiry: number = 0;

    constructor(config: AuthConfig, databaseId: string = DEFAULT_DATABASE) {
        this._config = config;
        this._databaseId = databaseId;
    }

    /**
     * Get a collection reference.
     */
    collection(collectionPath: string): CollectionReference {
        return new CollectionReference(this, collectionPath);
    }

    /**
     * Get a document reference.
     */
    doc(documentPath: string): DocumentReference {
        return new DocumentReference(this, documentPath);
    }

    /**
     * Run a transaction.
     */
    async runTransaction<R>(
        updateFn: (transaction: Transaction) => Promise<R>,
        options?: { maxAttempts?: number },
    ): Promise<R> {
        const maxAttempts = options?.maxAttempts ?? 5;
        let lastError: Error | null = null;
        let retryTransaction: string | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // Begin transaction
                const transactionId =
                    await this._beginTransaction(retryTransaction);
                const transaction = new Transaction(this, transactionId);

                // Run user function
                const result = await updateFn(transaction);

                // Commit transaction
                await this._commitTransaction(
                    transactionId,
                    transaction._getWrites(),
                );

                return result;
            } catch (error) {
                lastError = error as Error;

                // Check if this is a contention error that should be retried
                if (
                    error instanceof Error &&
                    error.message.includes("ABORTED")
                ) {
                    // Use the failed transaction ID for retry
                    retryTransaction = undefined; // Will create new transaction
                    continue;
                }

                // Non-retryable error
                throw error;
            }
        }

        throw lastError ?? new Error("Transaction failed after max attempts");
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    /** @internal */
    async _getToken(): Promise<string> {
        // Check config type first
        if ("privateKey" in this._config) {
            // Service Account flow with caching
            if (this._token && Date.now() < this._tokenExpiry - 60000) {
                return this._token;
            }

            this._token = await getFirestoreToken(this._config);
            this._tokenExpiry = Date.now() + 3600 * 1000; // 1 hour
            return this._token;
        } else {
            // Token/User flow: the provided function is invoked for each call.
            // If the implementation performs its own caching, that behavior will be honored.
            return await this._config.token();
        }
    }

    /** @internal */
    _getDatabasePath(): string {
        return `projects/${this._config.projectId}/databases/${this._databaseId}`;
    }

    /** @internal */
    _getDocumentName(path: string): string {
        return `${this._getDatabasePath()}/documents/${path}`;
    }

    /** @internal */
    async _getDocument(
        path: string,
        transactionId?: string,
    ): Promise<FirestoreDocument | null> {
        const token = await this._getToken();
        const docName = this._getDocumentName(path);

        let url = `${API_BASE}/${docName}`;
        if (transactionId) {
            url += `?transaction=${encodeURIComponent(transactionId)}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get document: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    /** @internal */
    async _setDocument(
        path: string,
        data: Record<string, unknown>,
        options?: { merge?: boolean },
    ): Promise<WriteResult> {
        const token = await this._getToken();
        const database = this._getDatabasePath();
        const docName = this._getDocumentName(path);

        const fields = toFirestoreFields(data);
        const transforms = extractFieldTransforms(data);

        const writes: Write[] = [
            {
                update: {
                    name: docName,
                    fields,
                },
            },
        ];

        if (options?.merge) {
            const fieldPaths = getFieldPaths(data, "", isFieldValue);
            writes[0].updateMask = { fieldPaths };
        }

        if (transforms.length > 0) {
            writes[0].updateTransforms = transforms;
        }

        const response = await fetch(
            `${API_BASE}/${database}/documents:commit`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ writes }),
            },
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to set document: ${JSON.stringify(error)}`);
        }

        const result: CommitResponse = await response.json();
        return result.writeResults?.[0] ?? {};
    }

    /** @internal */
    async _updateDocument(
        path: string,
        data: Record<string, unknown>,
    ): Promise<WriteResult> {
        const token = await this._getToken();
        const database = this._getDatabasePath();
        const docName = this._getDocumentName(path);

        const deleteFields = extractDeleteFields(data);
        const transforms = extractFieldTransforms(data);
        const transformFields = extractTransformFields(data);

        // Get all field paths, excluding delete fields and transform fields
        const fieldPaths = getFieldPaths(data, "", isFieldValue).filter(
            (p) => !deleteFields.includes(p) && !transformFields.includes(p),
        );

        // Build fields for non-FieldValue data, also handling dot-notation
        const fields = buildUpdateFields(data, toFirestoreValue, isFieldValue);

        // Combine updateMask: regular fields + delete fields (transforms are NOT in mask)
        const updateMaskPaths = [...fieldPaths, ...deleteFields];

        const writes: Write[] = [];

        // If we have regular fields or delete fields, create an update write
        if (updateMaskPaths.length > 0) {
            const write: Write = {
                update: {
                    name: docName,
                    fields,
                },
                updateMask: { fieldPaths: updateMaskPaths },
                currentDocument: { exists: true },
            };
            writes.push(write);
        }

        // If we have transforms, add them
        if (transforms.length > 0) {
            if (writes.length > 0) {
                // Add transforms to the existing update write
                writes[0].updateTransforms = transforms;
            } else {
                // Transform-only: use a transform write
                writes.push({
                    transform: {
                        document: docName,
                        fieldTransforms: transforms,
                    },
                    currentDocument: { exists: true },
                });
            }
        }

        if (writes.length === 0) {
            // Nothing to write
            return {};
        }

        const response = await fetch(
            `${API_BASE}/${database}/documents:commit`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ writes }),
            },
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                `Failed to update document: ${JSON.stringify(error)}`,
            );
        }

        const result: CommitResponse = await response.json();
        return result.writeResults?.[0] ?? {};
    }

    /** @internal */
    async _deleteDocument(path: string): Promise<void> {
        const token = await this._getToken();
        const database = this._getDatabasePath();
        const docName = this._getDocumentName(path);

        const response = await fetch(
            `${API_BASE}/${database}/documents:commit`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    writes: [{ delete: docName }],
                }),
            },
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                `Failed to delete document: ${JSON.stringify(error)}`,
            );
        }
    }

    /** @internal */
    async _beginTransaction(retryTransaction?: string): Promise<string> {
        const token = await this._getToken();
        const database = this._getDatabasePath();

        const options: TransactionOptions = {
            readWrite: retryTransaction ? { retryTransaction } : {},
        };

        const response = await fetch(
            `${API_BASE}/${database}/documents:beginTransaction`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ options }),
            },
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                `Failed to begin transaction: ${JSON.stringify(error)}`,
            );
        }

        const result: BeginTransactionResponse = await response.json();
        return result.transaction;
    }

    /** @internal */
    async _commitTransaction(
        transactionId: string,
        writes: Write[],
    ): Promise<CommitResponse> {
        const token = await this._getToken();
        const database = this._getDatabasePath();

        const response = await fetch(
            `${API_BASE}/${database}/documents:commit`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    writes,
                    transaction: transactionId,
                }),
            },
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                `Failed to commit transaction: ${JSON.stringify(error)}`,
            );
        }

        return response.json();
    }

    // ========================================================================
    // Query Methods
    // ========================================================================

    /** @internal Run a structured query against a collection */
    async _runQuery(
        collectionPath: string,
        query: StructuredQuery,
        transactionId?: string,
    ): Promise<RunQueryResponseItem[]> {
        const token = await this._getToken();
        const database = this._getDatabasePath();

        // Extract collection ID from path
        const pathParts = collectionPath.split("/");
        const collectionId = pathParts[pathParts.length - 1];

        // Build the parent path for the query
        let parent = `${database}/documents`;
        if (pathParts.length > 1) {
            parent = `${database}/documents/${pathParts.slice(0, -1).join("/")}`;
        }

        // Add collection selector
        const structuredQuery: StructuredQuery = {
            ...query,
            from: [{ collectionId }],
        };

        const body: Record<string, unknown> = { structuredQuery };
        if (transactionId) {
            body.transaction = transactionId;
        }

        const response = await fetch(`${API_BASE}/${parent}:runQuery`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to run query: ${JSON.stringify(error)}`);
        }

        const results: RunQueryResponseItem[] = await response.json();
        return results;
    }

    /** @internal Run an aggregation query against a collection */
    async _runAggregationQuery(
        collectionPath: string,
        query: StructuredQuery,
        aggregations: Aggregation[],
    ): Promise<AggregationResult> {
        const token = await this._getToken();
        const database = this._getDatabasePath();

        // Extract collection ID from path
        const pathParts = collectionPath.split("/");
        const collectionId = pathParts[pathParts.length - 1];

        // Build the parent path for the query
        let parent = `${database}/documents`;
        if (pathParts.length > 1) {
            parent = `${database}/documents/${pathParts.slice(0, -1).join("/")}`;
        }

        // Add collection selector
        const structuredQuery: StructuredQuery = {
            ...query,
            from: [{ collectionId }],
        };

        const body = {
            structuredAggregationQuery: {
                structuredQuery,
                aggregations,
            },
        };

        const response = await fetch(
            `${API_BASE}/${parent}:runAggregationQuery`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                `Failed to run aggregation query: ${JSON.stringify(error)}`,
            );
        }

        const results = await response.json();
        // The response is an array with one element
        return results[0] ?? { result: { aggregateFields: {} }, readTime: "" };
    }
}
