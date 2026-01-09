/**
 * Firestore Transaction
 */

import { DocumentReference, DocumentSnapshotImpl } from "./references.js";
import type {
    DocumentData,
    DocumentSnapshot,
    FirestoreClientInterface,
    FirestoreDocument,
    Write,
} from "./types.js";
import { getFieldPaths } from "./utils.js";
import {
    extractDeleteFields,
    extractFieldTransforms,
    isFieldValue,
    toFirestoreFields,
} from "./value.js";

/**
 * A Firestore transaction.
 * All reads must happen before any writes.
 */
export class Transaction {
    private readonly _writes: Write[] = [];

    constructor(
        private readonly _firestore: FirestoreClientInterface & {
            _getDocument(
                path: string,
                transactionId?: string,
            ): Promise<FirestoreDocument | null>;
        },
        private readonly _transactionId: string,
    ) {}

    /**
     * Get a document within this transaction.
     */
    async get<T = DocumentData>(
        ref: DocumentReference<T>,
    ): Promise<DocumentSnapshot<T>> {
        const doc = await this._firestore._getDocument(
            ref.path,
            this._transactionId,
        );
        return new DocumentSnapshotImpl<T>(doc, ref.path);
    }

    /**
     * Queue a set operation.
     */
    set<T = DocumentData>(
        ref: DocumentReference<T>,
        data: T,
        options?: { merge?: boolean },
    ): Transaction {
        const docName = this._firestore._getDocumentName(ref.path);
        const fields = toFirestoreFields(data as Record<string, unknown>);
        const transforms = extractFieldTransforms(
            data as Record<string, unknown>,
        );

        const write: Write = {
            update: {
                name: docName,
                fields,
            },
        };

        // Handle merge option
        if (options?.merge) {
            const fieldPaths = getFieldPaths(
                data as Record<string, unknown>,
                "",
                isFieldValue,
            );
            write.updateMask = { fieldPaths };
        }

        // Add transforms if any
        if (transforms.length > 0) {
            write.updateTransforms = transforms;
        }

        this._writes.push(write);
        return this;
    }

    /**
     * Queue an update operation.
     */
    update<T = DocumentData>(
        ref: DocumentReference<T>,
        data: Partial<T>,
    ): Transaction {
        const docName = this._firestore._getDocumentName(ref.path);

        // Filter out FieldValue.delete() fields for the update mask
        const deleteFields = extractDeleteFields(
            data as Record<string, unknown>,
        );
        const transforms = extractFieldTransforms(
            data as Record<string, unknown>,
        );

        // Get all field paths that are being set (not deleted or transformed)
        const fieldPaths = getFieldPaths(
            data as Record<string, unknown>,
            "",
            isFieldValue,
        ).filter((p) => !deleteFields.includes(p));

        // Build fields, excluding FieldValue sentinels
        const fields = toFirestoreFields(data as Record<string, unknown>);

        const write: Write = {
            update: {
                name: docName,
                fields,
            },
            updateMask: { fieldPaths: [...fieldPaths, ...deleteFields] },
            currentDocument: { exists: true },
        };

        if (transforms.length > 0) {
            write.updateTransforms = transforms;
        }

        this._writes.push(write);
        return this;
    }

    /**
     * Queue a delete operation.
     */
    delete(ref: DocumentReference): Transaction {
        const docName = this._firestore._getDocumentName(ref.path);
        this._writes.push({
            delete: docName,
        });
        return this;
    }

    /** @internal */
    _getWrites(): Write[] {
        return this._writes;
    }

    /** @internal */
    _getTransactionId(): string {
        return this._transactionId;
    }
}
