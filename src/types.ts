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
    /**
     * A function that returns a valid authentication token to use with the Firestore
     * REST API, such as an OAuth 2.0 bearer token or a Firebase Auth ID token.
     *
     * This function is called on every outgoing request and the returned token is
     * not cached by this library. If token reuse, caching, or automatic refresh
     * (e.g. when using short‑lived access tokens) is desired, that logic must be
     * implemented inside this function.
     */
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

// ============================================================================
// Query Types
// ============================================================================

/** Filter operators for where() clauses */
export type WhereFilterOp =
    | "<"
    | "<="
    | "=="
    | "!="
    | ">="
    | ">"
    | "array-contains"
    | "array-contains-any"
    | "in"
    | "not-in";

/** Order direction for orderBy() */
export type OrderByDirection = "asc" | "desc";

// ============================================================================
// REST API Structured Query Types
// ============================================================================

/** A selector for a collection */
export interface CollectionSelector {
    /** The collection ID (relative, not full path) */
    collectionId: string;
    /** When true, selects all descendant collections */
    allDescendants?: boolean;
}

/** A field reference */
export interface FieldReference {
    /** The field path */
    fieldPath: string;
}

/** An ordering on a field */
export interface Order {
    /** The field to order on */
    field: FieldReference;
    /** The direction to order by */
    direction?: "ASCENDING" | "DESCENDING";
}

/** A position in a query result set */
export interface Cursor {
    /** Values that represent a position */
    values: FirestoreValue[];
    /** If the position is before the values */
    before?: boolean;
}

/** A projection of fields to return */
export interface Projection {
    /** The fields to return */
    fields: FieldReference[];
}

/** A filter on a specific field */
export interface FieldFilter {
    /** The field to filter on */
    field: FieldReference;
    /** The operator to filter by */
    op:
        | "LESS_THAN"
        | "LESS_THAN_OR_EQUAL"
        | "GREATER_THAN"
        | "GREATER_THAN_OR_EQUAL"
        | "EQUAL"
        | "NOT_EQUAL"
        | "ARRAY_CONTAINS"
        | "IN"
        | "ARRAY_CONTAINS_ANY"
        | "NOT_IN";
    /** The value to compare to */
    value: FirestoreValue;
}

/** A filter that merges multiple other filters */
export interface CompositeFilter {
    /** The operator for combining multiple filters */
    op: "AND" | "OR";
    /** The list of filters to combine */
    filters: Filter[];
}

/** A filter on a single field for unary operators */
export interface UnaryFilter {
    /** The unary operator to apply */
    op: "IS_NAN" | "IS_NULL" | "IS_NOT_NAN" | "IS_NOT_NULL";
    /** The field to apply the filter on */
    field: FieldReference;
}

/** A filter */
export interface Filter {
    /** A composite filter */
    compositeFilter?: CompositeFilter;
    /** A filter on a field */
    fieldFilter?: FieldFilter;
    /** A filter with a unary operator */
    unaryFilter?: UnaryFilter;
}

/** A structured query */
export interface StructuredQuery {
    /** The collections to query */
    from?: CollectionSelector[];
    /** The filter to apply */
    where?: Filter;
    /** The order to apply to the query results */
    orderBy?: Order[];
    /** A starting point for the query results */
    startAt?: Cursor;
    /** An end point for the query results */
    endAt?: Cursor;
    /** The number of documents to skip */
    offset?: number;
    /** The maximum number of results to return */
    limit?: { value: number };
    /** The projection to return */
    select?: Projection;
}

/** A single result from a runQuery call */
export interface RunQueryResponseItem {
    /** A query result (if present) */
    document?: FirestoreDocument;
    /** The time at which the document was read */
    readTime?: string;
    /** If present, Firestore has completely finished the request */
    done?: boolean;
    /** The number of documents skipped (for offset) */
    skippedResults?: number;
}

/** An aggregation to run on a query */
export interface Aggregation {
    /** Optional. The alias for the aggregation result */
    alias?: string;
    /** Count aggregation */
    count?: Record<string, never>;
    /** Sum aggregation */
    sum?: { field: FieldReference };
    /** Average aggregation */
    avg?: { field: FieldReference };
}

/** Result of an aggregation query */
export interface AggregationResult {
    /** The aggregation results */
    result: {
        aggregateFields: Record<string, FirestoreValue>;
    };
    /** The time at which the aggregate was computed */
    readTime: string;
}

/** A snapshot of query results */
export interface QuerySnapshot<T = DocumentData> {
    /** The documents in this snapshot */
    readonly docs: QueryDocumentSnapshot<T>[];
    /** True if there are no documents */
    readonly empty: boolean;
    /** The number of documents */
    readonly size: number;
    /** Execute a callback for each document */
    forEach(callback: (doc: QueryDocumentSnapshot<T>) => void): void;
}

/** A snapshot of a document in a query result (always exists) */
export interface QueryDocumentSnapshot<
    T = DocumentData,
> extends DocumentSnapshot<T> {
    /** Always true for query document snapshots */
    readonly exists: true;
    /** The document data (always defined) */
    data(): T;
}

/** A snapshot of an aggregate query result */
export interface AggregateQuerySnapshot {
    /** The count result */
    data(): { count: number };
}

// ============================================================================
// Client Interface
// ============================================================================

/**
 * Interface for the Firestore client.
 * Used internally by Query, DocumentReference, and CollectionReference.
 */
export interface FirestoreClientInterface {
    // Document operations
    _getDocument(
        path: string,
        transactionId?: string,
    ): Promise<FirestoreDocument | null>;
    _getDocumentName(path: string): string;
    _setDocument(
        path: string,
        data: Record<string, unknown>,
        options?: { merge?: boolean },
    ): Promise<WriteResult>;
    _updateDocument(
        path: string,
        data: Record<string, unknown>,
    ): Promise<WriteResult>;
    _deleteDocument(path: string): Promise<void>;
    // Query operations
    _runQuery(
        collectionPath: string,
        query: StructuredQuery,
        transactionId?: string,
    ): Promise<RunQueryResponseItem[]>;
    _runAggregationQuery(
        collectionPath: string,
        query: StructuredQuery,
        aggregations: Aggregation[],
    ): Promise<AggregationResult>;
}
