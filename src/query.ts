/**
 * Query Implementation
 *
 * Fluent query builder for Firestore collections.
 */

import type {
    AggregateQuerySnapshot,
    Aggregation,
    AggregationResult,
    Cursor,
    DocumentData,
    Filter,
    FirestoreDocument,
    FirestoreValue,
    Order,
    OrderByDirection,
    Projection,
    QueryDocumentSnapshot,
    QuerySnapshot,
    RunQueryResponseItem,
    StructuredQuery,
    WhereFilterOp,
} from "./types.js";
import { extractDocumentPath } from "./utils.js";
import { fromFirestoreFields, toFirestoreValue } from "./value.js";

// ============================================================================
// Client Interface for Queries
// ============================================================================

/** Client interface for query operations */
export interface QueryClientInterface {
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

// ============================================================================
// Query Constraints (Internal)
// ============================================================================

/** Internal representation of query constraints */
export interface QueryConstraints {
    filters: Filter[];
    orderBy: Order[];
    limit?: number;
    limitToLast?: number;
    offset?: number;
    startAt?: { values: unknown[]; before: boolean };
    endAt?: { values: unknown[]; before: boolean };
    select?: string[];
}

// ============================================================================
// Operator Mapping
// ============================================================================

const OPERATOR_MAP: Record<WhereFilterOp, Filter["fieldFilter"]> = {
    "<": {
        field: { fieldPath: "" },
        op: "LESS_THAN",
        value: { nullValue: null },
    },
    "<=": {
        field: { fieldPath: "" },
        op: "LESS_THAN_OR_EQUAL",
        value: { nullValue: null },
    },
    "==": { field: { fieldPath: "" }, op: "EQUAL", value: { nullValue: null } },
    "!=": {
        field: { fieldPath: "" },
        op: "NOT_EQUAL",
        value: { nullValue: null },
    },
    ">=": {
        field: { fieldPath: "" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { nullValue: null },
    },
    ">": {
        field: { fieldPath: "" },
        op: "GREATER_THAN",
        value: { nullValue: null },
    },
    "array-contains": {
        field: { fieldPath: "" },
        op: "ARRAY_CONTAINS",
        value: { nullValue: null },
    },
    "array-contains-any": {
        field: { fieldPath: "" },
        op: "ARRAY_CONTAINS_ANY",
        value: { nullValue: null },
    },
    in: { field: { fieldPath: "" }, op: "IN", value: { nullValue: null } },
    "not-in": {
        field: { fieldPath: "" },
        op: "NOT_IN",
        value: { nullValue: null },
    },
};

function getRestOperator(op: WhereFilterOp): Filter["fieldFilter"]["op"] {
    return OPERATOR_MAP[op]?.op ?? "EQUAL";
}

// ============================================================================
// Query Document Snapshot Implementation
// ============================================================================

/** Implementation of QueryDocumentSnapshot */
class QueryDocumentSnapshotImpl<
    T = DocumentData,
> implements QueryDocumentSnapshot<T> {
    readonly exists: true = true;
    readonly id: string;
    readonly path: string;
    readonly createTime?: Date;
    readonly updateTime?: Date;

    private readonly _data: T;

    constructor(doc: FirestoreDocument) {
        this._data = fromFirestoreFields(doc.fields ?? {}) as T;
        this.path = doc.name ? extractDocumentPath(doc.name) : "";
        this.id = this.path.split("/").pop() ?? "";
        this.createTime = doc.createTime ? new Date(doc.createTime) : undefined;
        this.updateTime = doc.updateTime ? new Date(doc.updateTime) : undefined;
    }

    data(): T {
        return this._data;
    }

    get(fieldPath: string): unknown {
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

// ============================================================================
// Query Snapshot Implementation
// ============================================================================

/** Implementation of QuerySnapshot */
class QuerySnapshotImpl<T = DocumentData> implements QuerySnapshot<T> {
    readonly docs: QueryDocumentSnapshot<T>[];
    readonly empty: boolean;
    readonly size: number;

    constructor(documents: FirestoreDocument[]) {
        this.docs = documents.map(
            (doc) => new QueryDocumentSnapshotImpl<T>(doc),
        );
        this.empty = this.docs.length === 0;
        this.size = this.docs.length;
    }

    forEach(callback: (doc: QueryDocumentSnapshot<T>) => void): void {
        this.docs.forEach(callback);
    }
}

// ============================================================================
// Aggregate Query Snapshot Implementation
// ============================================================================

/** Implementation of AggregateQuerySnapshot */
class AggregateQuerySnapshotImpl implements AggregateQuerySnapshot {
    private readonly _count: number;

    constructor(result: AggregationResult) {
        const countField = result.result?.aggregateFields?.count_alias;
        if (countField && "integerValue" in countField) {
            this._count = parseInt(countField.integerValue, 10);
        } else {
            this._count = 0;
        }
    }

    data(): { count: number } {
        return { count: this._count };
    }
}

// ============================================================================
// Query Class
// ============================================================================

/**
 * A Query refers to a query which you can read or listen to.
 * You can refine a Query with query constraints.
 */
export class Query<T = DocumentData> {
    /** @internal */
    protected readonly _firestore: QueryClientInterface;
    /** @internal */
    protected readonly _collectionPath: string;
    /** @internal */
    protected readonly _constraints: QueryConstraints;

    constructor(
        firestore: QueryClientInterface,
        collectionPath: string,
        constraints?: QueryConstraints,
    ) {
        this._firestore = firestore;
        this._collectionPath = collectionPath;
        this._constraints = constraints ?? {
            filters: [],
            orderBy: [],
        };
    }

    // ========================================================================
    // Filter Methods
    // ========================================================================

    /**
     * Creates a new query with an additional filter.
     */
    where(fieldPath: string, opStr: WhereFilterOp, value: unknown): Query<T> {
        const filter: Filter = {
            fieldFilter: {
                field: { fieldPath },
                op: getRestOperator(opStr),
                value: toFirestoreValue(value) as FirestoreValue,
            },
        };

        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            filters: [...this._constraints.filters, filter],
        });
    }

    // ========================================================================
    // Order Methods
    // ========================================================================

    /**
     * Creates a new query with an additional ordering.
     */
    orderBy(
        fieldPath: string,
        directionStr: OrderByDirection = "asc",
    ): Query<T> {
        const order: Order = {
            field: { fieldPath },
            direction: directionStr === "asc" ? "ASCENDING" : "DESCENDING",
        };

        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            orderBy: [...this._constraints.orderBy, order],
        });
    }

    // ========================================================================
    // Limit Methods
    // ========================================================================

    /**
     * Creates a new query that returns only the first matching documents.
     */
    limit(count: number): Query<T> {
        if (count < 0) {
            throw new Error("Limit must be non-negative");
        }
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            limit: count,
            limitToLast: undefined,
        });
    }

    /**
     * Creates a new query that returns only the last matching documents.
     * Must be used with at least one orderBy clause.
     */
    limitToLast(count: number): Query<T> {
        if (count < 0) {
            throw new Error("Limit must be non-negative");
        }
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            limitToLast: count,
            limit: undefined,
        });
    }

    /**
     * Creates a new query that skips the first matching documents.
     */
    offset(count: number): Query<T> {
        if (count < 0) {
            throw new Error("Offset must be non-negative");
        }
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            offset: count,
        });
    }

    // ========================================================================
    // Cursor Methods
    // ========================================================================

    /**
     * Creates a new query starting at the provided values (inclusive).
     */
    startAt(...values: unknown[]): Query<T> {
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            startAt: { values, before: true },
        });
    }

    /**
     * Creates a new query starting after the provided values (exclusive).
     */
    startAfter(...values: unknown[]): Query<T> {
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            startAt: { values, before: false },
        });
    }

    /**
     * Creates a new query ending at the provided values (inclusive).
     */
    endAt(...values: unknown[]): Query<T> {
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            endAt: { values, before: false },
        });
    }

    /**
     * Creates a new query ending before the provided values (exclusive).
     */
    endBefore(...values: unknown[]): Query<T> {
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            endAt: { values, before: true },
        });
    }

    // ========================================================================
    // Projection Methods
    // ========================================================================

    /**
     * Creates a new query that returns only specific fields.
     */
    select(...fields: string[]): Query<T> {
        return new Query<T>(this._firestore, this._collectionPath, {
            ...this._constraints,
            select: fields,
        });
    }

    // ========================================================================
    // Execution Methods
    // ========================================================================

    /**
     * Executes the query and returns the results.
     */
    async get(): Promise<QuerySnapshot<T>> {
        const structuredQuery = this._toStructuredQuery();
        const results = await this._firestore._runQuery(
            this._collectionPath,
            structuredQuery,
        );

        // Extract documents from results
        const documents: FirestoreDocument[] = [];
        for (const item of results) {
            if (item.document) {
                documents.push(item.document);
            }
        }

        // Handle limitToLast by reversing results
        if (this._constraints.limitToLast !== undefined) {
            documents.reverse();
        }

        return new QuerySnapshotImpl<T>(documents);
    }

    /**
     * Returns a count of the documents matching the query.
     */
    async count(): Promise<AggregateQuerySnapshot> {
        const structuredQuery = this._toStructuredQuery();
        // Remove limit for count queries
        delete structuredQuery.limit;
        delete structuredQuery.offset;

        const result = await this._firestore._runAggregationQuery(
            this._collectionPath,
            structuredQuery,
            [{ alias: "count_alias", count: {} }],
        );

        return new AggregateQuerySnapshotImpl(result);
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    /**
     * Converts the query constraints to a StructuredQuery.
     * @internal
     */
    _toStructuredQuery(): StructuredQuery {
        const query: StructuredQuery = {};

        // Build where clause
        if (this._constraints.filters.length === 1) {
            query.where = this._constraints.filters[0];
        } else if (this._constraints.filters.length > 1) {
            query.where = {
                compositeFilter: {
                    op: "AND",
                    filters: this._constraints.filters,
                },
            };
        }

        // Build orderBy
        if (this._constraints.orderBy.length > 0) {
            query.orderBy = this._constraints.orderBy;

            // For limitToLast, reverse the order for the query
            if (this._constraints.limitToLast !== undefined) {
                query.orderBy = query.orderBy.map((order) => ({
                    ...order,
                    direction:
                        order.direction === "ASCENDING"
                            ? "DESCENDING"
                            : "ASCENDING",
                }));
            }
        }

        // Build limit
        const limitValue =
            this._constraints.limit ?? this._constraints.limitToLast;
        if (limitValue !== undefined) {
            query.limit = { value: limitValue };
        }

        // Build offset
        if (this._constraints.offset !== undefined) {
            query.offset = this._constraints.offset;
        }

        // Build cursors
        if (this._constraints.startAt) {
            query.startAt = this._buildCursor(this._constraints.startAt);
        }
        if (this._constraints.endAt) {
            query.endAt = this._buildCursor(this._constraints.endAt);
        }

        // Build projection
        if (this._constraints.select && this._constraints.select.length > 0) {
            query.select = this._buildProjection(this._constraints.select);
        }

        return query;
    }

    /**
     * Builds a cursor from values.
     * @internal
     */
    private _buildCursor(cursor: {
        values: unknown[];
        before: boolean;
    }): Cursor {
        return {
            values: cursor.values.map(
                (v) => toFirestoreValue(v) as FirestoreValue,
            ),
            before: cursor.before,
        };
    }

    /**
     * Builds a projection from field paths.
     * @internal
     */
    private _buildProjection(fields: string[]): Projection {
        return {
            fields: fields.map((fieldPath) => ({ fieldPath })),
        };
    }
}
