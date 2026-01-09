/**
 * Firestore REST API Types
 *
 * These types match the Firestore REST API v1 specification.
 * @see https://firebase.google.com/docs/firestore/reference/rest
 */

// ============================================================================
// Value Types
// ============================================================================

/** A null value in Firestore */
export interface NullValue {
    nullValue: null;
}

/** A boolean value in Firestore */
export interface BooleanValue {
    booleanValue: boolean;
}

/** An integer value in Firestore (stored as string for 64-bit precision) */
export interface IntegerValue {
    integerValue: string;
}

/** A double/float value in Firestore */
export interface DoubleValue {
    doubleValue: number;
}

/** A timestamp value in Firestore (RFC3339 format) */
export interface TimestampValue {
    timestampValue: string;
}

/** A string value in Firestore */
export interface StringValue {
    stringValue: string;
}

/** A bytes value in Firestore (base64 encoded) */
export interface BytesValue {
    bytesValue: string;
}

/** A reference to another document */
export interface ReferenceValue {
    referenceValue: string;
}

/** A geographic point (latitude/longitude) */
export interface GeoPointValue {
    geoPointValue: {
        latitude: number;
        longitude: number;
    };
}

/** An array value containing other Firestore values */
export interface ArrayValue {
    arrayValue: {
        values?: FirestoreValue[];
    };
}

/** A map/object value containing named fields */
export interface MapValue {
    mapValue: {
        fields?: Record<string, FirestoreValue>;
    };
}

/** Union of all possible Firestore value types */
export type FirestoreValue =
    | NullValue
    | BooleanValue
    | IntegerValue
    | DoubleValue
    | TimestampValue
    | StringValue
    | BytesValue
    | ReferenceValue
    | GeoPointValue
    | ArrayValue
    | MapValue;

// ============================================================================
// Document Types
// ============================================================================

/** A Firestore document as returned by the REST API */
export interface FirestoreDocument {
    /** The resource name of the document */
    name?: string;
    /** The document fields */
    fields?: Record<string, FirestoreValue>;
    /** Timestamp when the document was created */
    createTime?: string;
    /** Timestamp when the document was last updated */
    updateTime?: string;
}

// ============================================================================
// Write Operation Types
// ============================================================================

/** A precondition for a write operation */
export interface Precondition {
    /** Document must exist */
    exists?: boolean;
    /** Document must have been last updated at this time */
    updateTime?: string;
}

/** A field transform operation */
export interface FieldTransform {
    /** The path of the field to transform */
    fieldPath: string;
    /** Set to server request time */
    setToServerValue?: "REQUEST_TIME";
    /** Increment numeric value */
    increment?: FirestoreValue;
    /** Maximum of current value and given value */
    maximum?: FirestoreValue;
    /** Minimum of current value and given value */
    minimum?: FirestoreValue;
    /** Append elements to array (if not present) */
    appendMissingElements?: ArrayValue["arrayValue"];
    /** Remove elements from array */
    removeAllFromArray?: ArrayValue["arrayValue"];
}

/** A document transformation */
export interface DocumentTransform {
    /** The name of the document to transform */
    document: string;
    /** The field transforms to apply */
    fieldTransforms: FieldTransform[];
}

/** A write operation */
export interface Write {
    /** A document to write (set) */
    update?: FirestoreDocument;
    /** A document to delete */
    delete?: string;
    /** A document transformation */
    transform?: DocumentTransform;
    /** Fields to update (for partial updates) */
    updateMask?: { fieldPaths: string[] };
    /** Transforms to apply after update */
    updateTransforms?: FieldTransform[];
    /** Precondition for this write */
    currentDocument?: Precondition;
}

/** Result of a write operation */
export interface WriteResult {
    /** The last update time of the document after applying the write */
    updateTime?: string;
    /** The results of applying transforms */
    transformResults?: FirestoreValue[];
}

// ============================================================================
// Transaction Types
// ============================================================================

/** Options for beginning a transaction */
export interface TransactionOptions {
    /** Read-only transaction options */
    readOnly?: {
        /** Read documents at the given time (RFC3339) */
        readTime?: string;
    };
    /** Read-write transaction options */
    readWrite?: {
        /** Retry transaction starting from this ID */
        retryTransaction?: string;
    };
}

// ============================================================================
// API Response Types
// ============================================================================

/** Response from beginTransaction */
export interface BeginTransactionResponse {
    /** The transaction ID (base64 encoded) */
    transaction: string;
}

/** Response from commit */
export interface CommitResponse {
    /** Results of each write operation */
    writeResults?: WriteResult[];
    /** Time the commit occurred */
    commitTime: string;
}

/** Response from batchGet */
export interface BatchGetResponse {
    /** A document that was found */
    found?: FirestoreDocument;
    /** A document name that was not found */
    missing?: string;
    /** The read time of this result */
    readTime?: string;
    /** Transaction ID if part of a transaction */
    transaction?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Authentication configuration for Firestore */
/** Configuration for using a service account */
export interface ServiceAccountConfig {
    /** The Firebase project ID */
    projectId: string;
    /** The service account private key (PEM format) */
    privateKey: string;
    /** The service account email */
    clientEmail: string;
}

/** Configuration for using a pre-generated token (e.g. Firebase Auth ID token) */
export interface TokenConfig {
    /** The Firebase project ID */
    projectId: string;
    /** A function that returns a token */
    token: () => string | Promise<string>;
}

/** Authentication configuration for Firestore */
export type AuthConfig = ServiceAccountConfig | TokenConfig;

/** Document data type - what users work with */
export type DocumentData = Record<string, unknown>;

// ============================================================================
// Snapshot Types
// ============================================================================

/** A snapshot of a document at a point in time */
export interface DocumentSnapshot<T = DocumentData> {
    /** Whether the document exists */
    readonly exists: boolean;
    /** The document ID */
    readonly id: string;
    /** The full document path */
    readonly path: string;
    /** The document data, or undefined if it doesn't exist */
    data(): T | undefined;
    /** Get a specific field value */
    get(fieldPath: string): unknown;
    /** Time the document was created */
    readonly createTime?: Date;
    /** Time the document was last updated */
    readonly updateTime?: Date;
}
