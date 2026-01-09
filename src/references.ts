/**
 * Document and Collection References
 */

import { Query } from "./query.js";
import type {
    DocumentData,
    DocumentSnapshot,
    FirestoreClientInterface,
    FirestoreDocument,
    WriteResult,
} from "./types.js";
import {
    extractDocumentId,
    generateDocumentId,
    parseDocumentPath,
} from "./utils.js";
import { fromFirestoreFields } from "./value.js";

/**
 * Document snapshot implementation.
 */
export class DocumentSnapshotImpl<
    T = DocumentData,
> implements DocumentSnapshot<T> {
    readonly exists: boolean;
    readonly id: string;
    readonly path: string;
    readonly createTime?: Date;
    readonly updateTime?: Date;

    private readonly _data?: T;

    constructor(doc: FirestoreDocument | null, path: string) {
        if (doc && doc.fields) {
            this.exists = true;
            this._data = fromFirestoreFields(doc.fields) as T;
            this.createTime = doc.createTime
                ? new Date(doc.createTime)
                : undefined;
            this.updateTime = doc.updateTime
                ? new Date(doc.updateTime)
                : undefined;
        } else {
            this.exists = false;
            this._data = undefined;
        }

        this.path = path;
        this.id = extractDocumentId(path);
    }

    data(): T | undefined {
        return this._data;
    }

    get(fieldPath: string): unknown {
        if (!this._data) return undefined;

        const parts = fieldPath.split(".");
        let current: unknown = this._data;

        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            if (typeof current !== "object") return undefined;
            current = (current as Record<string, unknown>)[part];
        }

        return current;
    }
}

/**
 * A reference to a Firestore document.
 */
export class DocumentReference<T = DocumentData> {
    readonly id: string;
    readonly path: string;

    constructor(
        private readonly _firestore: FirestoreClientInterface,
        path: string,
    ) {
        this.path = path;
        this.id = extractDocumentId(path);
    }

    /**
     * Get the parent collection reference.
     */
    get parent(): CollectionReference<T> {
        const { collection } = parseDocumentPath(this.path);
        return new CollectionReference<T>(this._firestore, collection);
    }

    /**
     * Get a subcollection of this document.
     */
    collection(collectionPath: string): CollectionReference {
        return new CollectionReference(
            this._firestore,
            `${this.path}/${collectionPath}`,
        );
    }

    /**
     * Get the document.
     */
    async get(): Promise<DocumentSnapshot<T>> {
        const doc = await this._firestore._getDocument(this.path);
        return new DocumentSnapshotImpl<T>(doc, this.path);
    }

    /**
     * Set the document data.
     */
    async set(data: T, options?: { merge?: boolean }): Promise<WriteResult> {
        return this._firestore._setDocument(
            this.path,
            data as Record<string, unknown>,
            options,
        );
    }

    /**
     * Update the document data.
     */
    async update(data: Partial<T>): Promise<WriteResult> {
        return this._firestore._updateDocument(
            this.path,
            data as Record<string, unknown>,
        );
    }

    /**
     * Delete the document.
     */
    async delete(): Promise<void> {
        await this._firestore._deleteDocument(this.path);
    }
}

/**
 * A reference to a Firestore collection.
 * Extends Query to provide query methods.
 */
export class CollectionReference<T = DocumentData> extends Query<T> {
    readonly id: string;
    readonly path: string;

    constructor(firestore: FirestoreClientInterface, path: string) {
        super(firestore, path);
        this.path = path;
        const parts = path.split("/");
        this.id = parts[parts.length - 1];
    }

    /**
     * Get a document reference in this collection.
     * If no ID is provided, a random one will be generated.
     */
    doc(documentId?: string): DocumentReference<T> {
        const docId = documentId ?? generateDocumentId();
        return new DocumentReference<T>(
            this._firestore,
            `${this.path}/${docId}`,
        );
    }

    /**
     * Add a new document with an auto-generated ID.
     */
    async add(data: T): Promise<DocumentReference<T>> {
        const ref = this.doc();
        await ref.set(data);
        return ref;
    }
}
