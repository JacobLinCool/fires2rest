/**
 * Query Unit Tests
 *
 * Tests for query building and constraint handling.
 */

import { describe, expect, it, vi } from "vitest";
import { Query } from "../src/query.js";
import type { FirestoreClientInterface } from "../src/types.js";

// ============================================================================
// Mock Client
// ============================================================================

function createMockClient(
    mockResults: {
        document?: { name: string; fields: Record<string, unknown> };
    }[] = [],
): FirestoreClientInterface {
    return {
        _getDocument: vi.fn(),
        _getDocumentName: vi.fn(),
        _setDocument: vi.fn(),
        _updateDocument: vi.fn(),
        _deleteDocument: vi.fn(),
        _runQuery: vi.fn().mockResolvedValue(mockResults),
        _runAggregationQuery: vi.fn().mockResolvedValue({
            result: { aggregateFields: { count_alias: { integerValue: "5" } } },
            readTime: "2024-01-01T00:00:00Z",
        }),
    } as FirestoreClientInterface;
}

// ============================================================================
// Query Building Tests
// ============================================================================

describe("Query", () => {
    describe("where()", () => {
        it("creates a query with a single filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where("age", ">", 18);
            const structured = query._toStructuredQuery();

            expect(structured.where).toEqual({
                fieldFilter: {
                    field: { fieldPath: "age" },
                    op: "GREATER_THAN",
                    value: { integerValue: "18" },
                },
            });
        });

        it("creates a query with equality filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where(
                "active",
                "==",
                true,
            );
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe("EQUAL");
            expect(structured.where?.fieldFilter?.value).toEqual({
                booleanValue: true,
            });
        });

        it("creates a query with not-equal filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where(
                "status",
                "!=",
                "deleted",
            );
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe("NOT_EQUAL");
            expect(structured.where?.fieldFilter?.value).toEqual({
                stringValue: "deleted",
            });
        });

        it("creates a query with less-than filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where("score", "<", 100);
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe("LESS_THAN");
        });

        it("creates a query with less-than-or-equal filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where("score", "<=", 100);
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe(
                "LESS_THAN_OR_EQUAL",
            );
        });

        it("creates a query with greater-than-or-equal filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where("score", ">=", 50);
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe(
                "GREATER_THAN_OR_EQUAL",
            );
        });

        it("creates a query with array-contains filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where(
                "tags",
                "array-contains",
                "admin",
            );
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe("ARRAY_CONTAINS");
            expect(structured.where?.fieldFilter?.value).toEqual({
                stringValue: "admin",
            });
        });

        it("creates a query with array-contains-any filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where(
                "tags",
                "array-contains-any",
                ["admin", "mod"],
            );
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe(
                "ARRAY_CONTAINS_ANY",
            );
        });

        it("creates a query with in filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where("status", "in", [
                "active",
                "pending",
            ]);
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe("IN");
        });

        it("creates a query with not-in filter", () => {
            const client = createMockClient();
            const query = new Query(client, "users").where("status", "not-in", [
                "deleted",
                "banned",
            ]);
            const structured = query._toStructuredQuery();

            expect(structured.where?.fieldFilter?.op).toBe("NOT_IN");
        });

        it("creates a composite filter with multiple where clauses", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .where("age", ">", 18)
                .where("active", "==", true);
            const structured = query._toStructuredQuery();

            expect(structured.where?.compositeFilter).toBeDefined();
            expect(structured.where?.compositeFilter?.op).toBe("AND");
            expect(structured.where?.compositeFilter?.filters).toHaveLength(2);
        });
    });

    describe("orderBy()", () => {
        it("creates a query with ascending order by default", () => {
            const client = createMockClient();
            const query = new Query(client, "users").orderBy("name");
            const structured = query._toStructuredQuery();

            expect(structured.orderBy).toEqual([
                {
                    field: { fieldPath: "name" },
                    direction: "ASCENDING",
                },
            ]);
        });

        it("creates a query with descending order", () => {
            const client = createMockClient();
            const query = new Query(client, "users").orderBy(
                "createdAt",
                "desc",
            );
            const structured = query._toStructuredQuery();

            expect(structured.orderBy).toEqual([
                {
                    field: { fieldPath: "createdAt" },
                    direction: "DESCENDING",
                },
            ]);
        });

        it("creates a query with multiple orderings", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("lastName")
                .orderBy("firstName");
            const structured = query._toStructuredQuery();

            expect(structured.orderBy).toHaveLength(2);
            expect(structured.orderBy?.[0].field.fieldPath).toBe("lastName");
            expect(structured.orderBy?.[1].field.fieldPath).toBe("firstName");
        });
    });

    describe("limit() and offset()", () => {
        it("creates a query with limit", () => {
            const client = createMockClient();
            const query = new Query(client, "users").limit(10);
            const structured = query._toStructuredQuery();

            expect(structured.limit).toEqual({ value: 10 });
        });

        it("creates a query with offset", () => {
            const client = createMockClient();
            const query = new Query(client, "users").offset(5);
            const structured = query._toStructuredQuery();

            expect(structured.offset).toBe(5);
        });

        it("creates a query with both limit and offset", () => {
            const client = createMockClient();
            const query = new Query(client, "users").limit(10).offset(20);
            const structured = query._toStructuredQuery();

            expect(structured.limit).toEqual({ value: 10 });
            expect(structured.offset).toBe(20);
        });

        it("throws for negative limit", () => {
            const client = createMockClient();
            expect(() => new Query(client, "users").limit(-1)).toThrow(
                "Limit must be non-negative",
            );
        });

        it("throws for negative offset", () => {
            const client = createMockClient();
            expect(() => new Query(client, "users").offset(-1)).toThrow(
                "Offset must be non-negative",
            );
        });
    });

    describe("limitToLast()", () => {
        it("reverses order for limitToLast query", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("createdAt", "asc")
                .limitToLast(5);
            const structured = query._toStructuredQuery();

            // Direction should be reversed in the structured query
            expect(structured.orderBy?.[0].direction).toBe("DESCENDING");
            expect(structured.limit).toEqual({ value: 5 });
        });

        it("throws for negative limitToLast", () => {
            const client = createMockClient();
            expect(() => new Query(client, "users").limitToLast(-1)).toThrow(
                "Limit must be non-negative",
            );
        });
    });

    describe("startAt() and startAfter()", () => {
        it("creates a query with startAt cursor", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("name")
                .startAt("Alice");
            const structured = query._toStructuredQuery();

            expect(structured.startAt).toBeDefined();
            expect(structured.startAt?.before).toBe(true);
            expect(structured.startAt?.values).toEqual([
                { stringValue: "Alice" },
            ]);
        });

        it("creates a query with startAfter cursor", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("name")
                .startAfter("Alice");
            const structured = query._toStructuredQuery();

            expect(structured.startAt).toBeDefined();
            expect(structured.startAt?.before).toBe(false);
            expect(structured.startAt?.values).toEqual([
                { stringValue: "Alice" },
            ]);
        });

        it("creates a query with multiple cursor values", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("lastName")
                .orderBy("firstName")
                .startAt("Smith", "John");
            const structured = query._toStructuredQuery();

            expect(structured.startAt?.values).toHaveLength(2);
        });
    });

    describe("endAt() and endBefore()", () => {
        it("creates a query with endAt cursor", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("name")
                .endAt("Zach");
            const structured = query._toStructuredQuery();

            expect(structured.endAt).toBeDefined();
            expect(structured.endAt?.before).toBe(false);
            expect(structured.endAt?.values).toEqual([{ stringValue: "Zach" }]);
        });

        it("creates a query with endBefore cursor", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .orderBy("name")
                .endBefore("Zach");
            const structured = query._toStructuredQuery();

            expect(structured.endAt).toBeDefined();
            expect(structured.endAt?.before).toBe(true);
            expect(structured.endAt?.values).toEqual([{ stringValue: "Zach" }]);
        });
    });

    describe("select()", () => {
        it("creates a query with field projection", () => {
            const client = createMockClient();
            const query = new Query(client, "users").select("name", "email");
            const structured = query._toStructuredQuery();

            expect(structured.select).toBeDefined();
            expect(structured.select?.fields).toHaveLength(2);
            expect(structured.select?.fields).toEqual([
                { fieldPath: "name" },
                { fieldPath: "email" },
            ]);
        });
    });

    describe("chained queries", () => {
        it("creates complex queries with multiple constraints", () => {
            const client = createMockClient();
            const query = new Query(client, "users")
                .where("age", ">=", 18)
                .where("active", "==", true)
                .orderBy("createdAt", "desc")
                .limit(10)
                .offset(5);
            const structured = query._toStructuredQuery();

            expect(structured.where?.compositeFilter).toBeDefined();
            expect(structured.orderBy).toHaveLength(1);
            expect(structured.limit).toEqual({ value: 10 });
            expect(structured.offset).toBe(5);
        });

        it("is immutable - each method returns a new query", () => {
            const client = createMockClient();
            const query1 = new Query(client, "users");
            const query2 = query1.where("age", ">", 18);
            const query3 = query2.limit(10);

            expect(query1._toStructuredQuery().where).toBeUndefined();
            expect(query2._toStructuredQuery().where).toBeDefined();
            expect(query2._toStructuredQuery().limit).toBeUndefined();
            expect(query3._toStructuredQuery().limit).toEqual({ value: 10 });
        });
    });

    describe("get()", () => {
        it("executes query and returns snapshot", async () => {
            const mockDocs = [
                {
                    document: {
                        name: "projects/test/databases/(default)/documents/users/user1",
                        fields: { name: { stringValue: "Alice" } },
                    },
                },
                {
                    document: {
                        name: "projects/test/databases/(default)/documents/users/user2",
                        fields: { name: { stringValue: "Bob" } },
                    },
                },
            ];
            const client = createMockClient(mockDocs);
            const query = new Query(client, "users");

            const snapshot = await query.get();

            expect(snapshot.size).toBe(2);
            expect(snapshot.empty).toBe(false);
            expect(snapshot.docs[0].data()).toEqual({ name: "Alice" });
            expect(snapshot.docs[1].data()).toEqual({ name: "Bob" });
        });

        it("returns empty snapshot when no results", async () => {
            const client = createMockClient([]);
            const query = new Query(client, "users");

            const snapshot = await query.get();

            expect(snapshot.empty).toBe(true);
            expect(snapshot.size).toBe(0);
            expect(snapshot.docs).toHaveLength(0);
        });

        it("calls forEach on each document", async () => {
            const mockDocs = [
                {
                    document: {
                        name: "projects/test/databases/(default)/documents/users/user1",
                        fields: { name: { stringValue: "Alice" } },
                    },
                },
            ];
            const client = createMockClient(mockDocs);
            const query = new Query(client, "users");

            const snapshot = await query.get();
            const names: string[] = [];
            snapshot.forEach((doc) =>
                names.push((doc.data() as { name: string }).name),
            );

            expect(names).toEqual(["Alice"]);
        });
    });

    describe("count()", () => {
        it("executes count aggregation", async () => {
            const client = createMockClient();
            const query = new Query(client, "users");

            const snapshot = await query.count();

            expect(snapshot.data()).toEqual({ count: 5 });
        });
    });
});

// ============================================================================
// QueryDocumentSnapshot Tests
// ============================================================================

describe("QueryDocumentSnapshot", () => {
    it("provides document id and path", async () => {
        const mockDocs = [
            {
                document: {
                    name: "projects/test/databases/(default)/documents/users/user123",
                    fields: { name: { stringValue: "Alice" } },
                },
            },
        ];
        const client = createMockClient(mockDocs);
        const query = new Query(client, "users");

        const snapshot = await query.get();

        expect(snapshot.docs[0].id).toBe("user123");
        expect(snapshot.docs[0].path).toBe("users/user123");
        expect(snapshot.docs[0].exists).toBe(true);
    });

    it("provides get() method for nested fields", async () => {
        const mockDocs = [
            {
                document: {
                    name: "projects/test/databases/(default)/documents/users/user1",
                    fields: {
                        profile: {
                            mapValue: {
                                fields: {
                                    name: { stringValue: "Alice" },
                                    age: { integerValue: "30" },
                                },
                            },
                        },
                    },
                },
            },
        ];
        const client = createMockClient(mockDocs);
        const query = new Query(client, "users");

        const snapshot = await query.get();

        expect(snapshot.docs[0].get("profile.name")).toBe("Alice");
        expect(snapshot.docs[0].get("profile.age")).toBe(30);
        expect(snapshot.docs[0].get("nonexistent")).toBeUndefined();
    });
});
