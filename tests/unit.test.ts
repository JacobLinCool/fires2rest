/**
 * Unit Tests with Mock Firestore
 */

import { describe, expect, it } from "vitest";

// ============================================================================
// Utils Tests
// ============================================================================

import {
    buildUpdateFields,
    extractDocumentPath,
    generateDocumentId,
    getFieldPaths,
    parseDocumentPath,
    quoteFieldPath,
    quoteFieldPathSegment,
} from "../src/utils.js";
import { isFieldValue, toFirestoreValue } from "../src/value.js";

describe("utils.ts", () => {
    describe("generateDocumentId", () => {
        it("generates 20 character alphanumeric IDs", () => {
            const id = generateDocumentId();
            expect(id).toHaveLength(20);
            expect(id).toMatch(/^[A-Za-z0-9]+$/);
        });

        it("generates unique IDs", () => {
            const ids = new Set(
                Array.from({ length: 100 }, generateDocumentId),
            );
            expect(ids.size).toBe(100);
        });
    });

    describe("parseDocumentPath", () => {
        it("parses valid document path", () => {
            const result = parseDocumentPath("users/user1");
            expect(result).toEqual({ collection: "users", docId: "user1" });
        });

        it("parses nested document path", () => {
            const result = parseDocumentPath("users/user1/posts/post1");
            expect(result).toEqual({
                collection: "users/user1/posts",
                docId: "post1",
            });
        });

        it("throws for invalid path with odd segments", () => {
            expect(() => parseDocumentPath("users")).toThrow(
                "Invalid document path",
            );
        });

        it("throws for single segment path", () => {
            expect(() => parseDocumentPath("collection")).toThrow(
                "Invalid document path",
            );
        });

        it("throws for path with three segments", () => {
            expect(() => parseDocumentPath("a/b/c")).toThrow(
                "Invalid document path",
            );
        });
    });

    describe("extractDocumentPath", () => {
        it("extracts path from full resource name", () => {
            const result = extractDocumentPath(
                "projects/my-project/databases/(default)/documents/users/user1",
            );
            expect(result).toBe("users/user1");
        });

        it("returns original name if no documents segment", () => {
            const result = extractDocumentPath("users/user1");
            expect(result).toBe("users/user1");
        });

        it("handles nested paths", () => {
            const result = extractDocumentPath(
                "projects/proj/databases/db/documents/col/doc/sub/subdoc",
            );
            expect(result).toBe("col/doc/sub/subdoc");
        });
    });

    describe("quoteFieldPathSegment", () => {
        it("returns simple identifiers unchanged", () => {
            expect(quoteFieldPathSegment("name")).toBe("name");
            expect(quoteFieldPathSegment("age")).toBe("age");
            expect(quoteFieldPathSegment("_private")).toBe("_private");
            expect(quoteFieldPathSegment("camelCase")).toBe("camelCase");
            expect(quoteFieldPathSegment("with123numbers")).toBe(
                "with123numbers",
            );
        });

        it("quotes segments with hyphens", () => {
            expect(quoteFieldPathSegment("item-001")).toBe("`item-001`");
            expect(quoteFieldPathSegment("my-field")).toBe("`my-field`");
        });

        it("quotes segments with spaces", () => {
            expect(quoteFieldPathSegment("my field")).toBe("`my field`");
        });

        it("quotes segments starting with numbers", () => {
            expect(quoteFieldPathSegment("123abc")).toBe("`123abc`");
            expect(quoteFieldPathSegment("0")).toBe("`0`");
        });

        it("quotes segments with special characters", () => {
            expect(quoteFieldPathSegment("field[0]")).toBe("`field[0]`");
            expect(quoteFieldPathSegment("field.name")).toBe("`field.name`");
            expect(quoteFieldPathSegment("field@domain")).toBe(
                "`field@domain`",
            );
        });

        it("escapes backticks within segments", () => {
            expect(quoteFieldPathSegment("field`name")).toBe("`field\\`name`");
        });

        it("escapes backslashes within segments", () => {
            expect(quoteFieldPathSegment("field\\name")).toBe(
                "`field\\\\name`",
            );
        });
    });

    describe("quoteFieldPath", () => {
        it("returns simple paths unchanged", () => {
            expect(quoteFieldPath("user.name")).toBe("user.name");
            expect(quoteFieldPath("a.b.c")).toBe("a.b.c");
        });

        it("quotes individual segments that need quoting", () => {
            expect(quoteFieldPath("itemsSold.item-001")).toBe(
                "itemsSold.`item-001`",
            );
            expect(quoteFieldPath("data.user-profile.name")).toBe(
                "data.`user-profile`.name",
            );
        });

        it("quotes multiple segments as needed", () => {
            expect(quoteFieldPath("my-data.item-001")).toBe(
                "`my-data`.`item-001`",
            );
        });
    });

    describe("getFieldPaths", () => {
        it("handles flat objects", () => {
            const paths = getFieldPaths({ a: 1, b: "two" }, "", isFieldValue);
            expect(paths).toEqual(["a", "b"]);
        });

        it("handles nested objects recursively", () => {
            const paths = getFieldPaths(
                { user: { name: "Alice", age: 30 } },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["user.name", "user.age"]);
        });

        it("handles deeply nested objects", () => {
            const paths = getFieldPaths(
                { a: { b: { c: { d: 1 } } } },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["a.b.c.d"]);
        });

        it("handles geopoint-like objects as leaf values", () => {
            const geoLike = { latitude: 37.7, longitude: -122.4 };
            const paths = getFieldPaths(
                { location: geoLike },
                "",
                isFieldValue,
            );
            // GeoPoint-like objects should be treated as leaf values
            expect(paths).toEqual(["location"]);
        });

        it("handles empty nested objects as leaf", () => {
            const paths = getFieldPaths(
                { data: {}, name: "test" },
                "",
                isFieldValue,
            );
            expect(paths).toContain("data");
            expect(paths).toContain("name");
        });

        it("handles dot-notation keys directly", () => {
            const paths = getFieldPaths(
                { "user.name": "Alice" },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["user.name"]);
        });

        it("handles arrays as leaf values", () => {
            const paths = getFieldPaths(
                { tags: ["a", "b"], name: "test" },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["tags", "name"]);
        });

        it("handles Date objects as leaf values", () => {
            const paths = getFieldPaths(
                { created: new Date(), name: "test" },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["created", "name"]);
        });

        it("uses prefix for nested paths", () => {
            const paths = getFieldPaths(
                { name: "test" },
                "parent",
                isFieldValue,
            );
            expect(paths).toEqual(["parent.name"]);
        });

        it("quotes keys with hyphens", () => {
            const paths = getFieldPaths({ "item-001": 5 }, "", isFieldValue);
            expect(paths).toEqual(["`item-001`"]);
        });

        it("quotes nested keys with hyphens", () => {
            const paths = getFieldPaths(
                { itemsSold: { "item-001": 5 } },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["itemsSold.`item-001`"]);
        });

        it("quotes dot-notation paths with special characters", () => {
            const paths = getFieldPaths(
                { "itemsSold.item-001": 5 },
                "",
                isFieldValue,
            );
            expect(paths).toEqual(["itemsSold.`item-001`"]);
        });
    });

    describe("buildUpdateFields", () => {
        it("builds fields from flat object", () => {
            const fields = buildUpdateFields(
                { name: "test", count: 5 },
                toFirestoreValue,
                isFieldValue,
            );
            expect(fields).toEqual({
                name: { stringValue: "test" },
                count: { integerValue: "5" },
            });
        });

        it("handles dot-notation paths", () => {
            const fields = buildUpdateFields(
                { "user.age": 30 },
                toFirestoreValue,
                isFieldValue,
            );
            expect(fields).toEqual({
                user: {
                    mapValue: {
                        fields: {
                            age: { integerValue: "30" },
                        },
                    },
                },
            });
        });

        it("handles deeply nested dot-notation paths", () => {
            const fields = buildUpdateFields(
                { "a.b.c": "deep" },
                toFirestoreValue,
                isFieldValue,
            );
            expect(fields).toEqual({
                a: {
                    mapValue: {
                        fields: {
                            b: {
                                mapValue: {
                                    fields: {
                                        c: { stringValue: "deep" },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });

        it("handles multiple dot-notation paths at same level", () => {
            const fields = buildUpdateFields(
                { "user.name": "Alice", "user.age": 25 },
                toFirestoreValue,
                isFieldValue,
            );
            expect(fields.user).toBeDefined();
            const userFields = (
                fields.user as { mapValue: { fields: Record<string, unknown> } }
            ).mapValue.fields;
            expect(userFields.name).toEqual({ stringValue: "Alice" });
            expect(userFields.age).toEqual({ integerValue: "25" });
        });
    });
});

// ============================================================================
// Field-Value Tests
// ============================================================================

import {
    FieldValue,
    getArrayRemoveElements,
    getArrayUnionElements,
    getIncrementAmount,
    isArrayRemove,
    isArrayUnion,
    isDeleteField,
    isIncrement,
    isServerTimestamp,
} from "../src/field-value.js";

describe("field-value.ts", () => {
    describe("type guards", () => {
        it("isServerTimestamp identifies correct type", () => {
            expect(isServerTimestamp(FieldValue.serverTimestamp())).toBe(true);
            expect(isServerTimestamp(FieldValue.delete())).toBe(false);
            expect(isServerTimestamp("not a field value")).toBe(false);
        });

        it("isDeleteField identifies correct type", () => {
            expect(isDeleteField(FieldValue.delete())).toBe(true);
            expect(isDeleteField(FieldValue.increment(1))).toBe(false);
        });

        it("isIncrement identifies correct type", () => {
            expect(isIncrement(FieldValue.increment(5))).toBe(true);
            expect(isIncrement(FieldValue.delete())).toBe(false);
        });

        it("isArrayUnion identifies correct type", () => {
            expect(isArrayUnion(FieldValue.arrayUnion("a"))).toBe(true);
            expect(isArrayUnion(FieldValue.arrayRemove("b"))).toBe(false);
        });

        it("isArrayRemove identifies correct type", () => {
            expect(isArrayRemove(FieldValue.arrayRemove("x"))).toBe(true);
            expect(isArrayRemove(FieldValue.arrayUnion("y"))).toBe(false);
        });
    });

    describe("getIncrementAmount", () => {
        it("returns amount for increment value", () => {
            expect(getIncrementAmount(FieldValue.increment(42))).toBe(42);
            expect(getIncrementAmount(FieldValue.increment(-10))).toBe(-10);
            expect(getIncrementAmount(FieldValue.increment(0))).toBe(0);
        });

        it("returns undefined for non-increment values", () => {
            expect(getIncrementAmount(FieldValue.delete())).toBeUndefined();
            expect(
                getIncrementAmount(FieldValue.serverTimestamp()),
            ).toBeUndefined();
            expect(getIncrementAmount("string")).toBeUndefined();
            expect(getIncrementAmount(null)).toBeUndefined();
            expect(getIncrementAmount({})).toBeUndefined();
        });
    });

    describe("getArrayUnionElements", () => {
        it("returns elements for arrayUnion value", () => {
            expect(
                getArrayUnionElements(FieldValue.arrayUnion("a", "b")),
            ).toEqual(["a", "b"]);
            expect(
                getArrayUnionElements(FieldValue.arrayUnion(1, 2, 3)),
            ).toEqual([1, 2, 3]);
        });

        it("returns undefined for non-arrayUnion values", () => {
            expect(getArrayUnionElements(FieldValue.delete())).toBeUndefined();
            expect(
                getArrayUnionElements(FieldValue.increment(1)),
            ).toBeUndefined();
            expect(getArrayUnionElements("string")).toBeUndefined();
            expect(getArrayUnionElements(null)).toBeUndefined();
        });
    });

    describe("getArrayRemoveElements", () => {
        it("returns elements for arrayRemove value", () => {
            expect(
                getArrayRemoveElements(FieldValue.arrayRemove("x", "y")),
            ).toEqual(["x", "y"]);
        });

        it("returns undefined for non-arrayRemove values", () => {
            expect(getArrayRemoveElements(FieldValue.delete())).toBeUndefined();
            expect(
                getArrayRemoveElements(FieldValue.arrayUnion("a")),
            ).toBeUndefined();
            expect(getArrayRemoveElements(42)).toBeUndefined();
            expect(getArrayRemoveElements(undefined)).toBeUndefined();
        });
    });
});

// ============================================================================
// Value Tests (additional coverage)
// ============================================================================

import type { FirestoreValue } from "../src/types.js";
import {
    extractFieldTransforms,
    extractTransformFields,
    fromFirestoreValue,
    Timestamp,
    toFirestoreValue as toValue,
} from "../src/value.js";

describe("value.ts additional coverage", () => {
    describe("Timestamp.now", () => {
        it("creates timestamp around current time", () => {
            const before = Date.now();
            const ts = Timestamp.now();
            const after = Date.now();

            const tsMillis = ts.toMillis();
            expect(tsMillis).toBeGreaterThanOrEqual(before);
            expect(tsMillis).toBeLessThanOrEqual(after);
        });
    });

    describe("fromFirestoreValue edge cases", () => {
        it("handles referenceValue", () => {
            const result = fromFirestoreValue({
                referenceValue:
                    "projects/my-project/databases/(default)/documents/users/user1",
            });
            expect(result).toBe(
                "projects/my-project/databases/(default)/documents/users/user1",
            );
        });

        it("handles empty array", () => {
            const result = fromFirestoreValue({
                arrayValue: {},
            } as unknown as FirestoreValue);
            expect(result).toEqual([]);
        });

        it("handles empty map", () => {
            const result = fromFirestoreValue({
                mapValue: {},
            } as unknown as FirestoreValue);
            expect(result).toEqual({});
        });

        it("throws for unknown value type", () => {
            expect(() => fromFirestoreValue({} as { nullValue: null })).toThrow(
                "Unknown Firestore value type",
            );
        });
    });

    describe("toFirestoreValue edge cases", () => {
        it("throws for Symbol type", () => {
            expect(() => toValue(Symbol("test"))).toThrow(
                "Unsupported value type",
            );
        });

        it("throws for BigInt type", () => {
            expect(() => toValue(BigInt(123))).toThrow(
                "Unsupported value type",
            );
        });

        it("throws for function type", () => {
            expect(() => toValue(() => {})).toThrow("Unsupported value type");
        });
    });

    describe("extractFieldTransforms with array operations", () => {
        it("extracts arrayUnion transform", () => {
            const transforms = extractFieldTransforms({
                tags: FieldValue.arrayUnion("new", "tags"),
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("tags");
            expect(transforms[0].appendMissingElements).toEqual({
                values: [{ stringValue: "new" }, { stringValue: "tags" }],
            });
        });

        it("extracts arrayRemove transform", () => {
            const transforms = extractFieldTransforms({
                tags: FieldValue.arrayRemove("old"),
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("tags");
            expect(transforms[0].removeAllFromArray).toEqual({
                values: [{ stringValue: "old" }],
            });
        });

        it("skips delete fields (handled separately)", () => {
            const transforms = extractFieldTransforms({
                obsolete: FieldValue.delete(),
            });
            expect(transforms).toHaveLength(0);
        });

        it("quotes field paths with special characters", () => {
            const transforms = extractFieldTransforms({
                "item-001": FieldValue.increment(1),
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("`item-001`");
        });

        it("quotes nested field paths with special characters", () => {
            const transforms = extractFieldTransforms({
                itemsSold: {
                    "item-001": FieldValue.increment(5),
                },
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("itemsSold.`item-001`");
        });

        it("quotes dot-notation field paths with special characters", () => {
            const transforms = extractFieldTransforms({
                "itemsSold.item-001": FieldValue.increment(5),
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("itemsSold.`item-001`");
        });

        it("quotes multi-segment dot-notation paths segment-by-segment", () => {
            const transforms = extractFieldTransforms({
                "a.b-c.d-e": FieldValue.increment(1),
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("a.`b-c`.`d-e`");
        });

        it("handles dot-notation keys within nested objects", () => {
            const transforms = extractFieldTransforms({
                stats: {
                    "itemsSold.item-001": FieldValue.increment(5),
                },
            });
            expect(transforms).toHaveLength(1);
            expect(transforms[0].fieldPath).toBe("stats.itemsSold.`item-001`");
        });
    });

    describe("extractTransformFields", () => {
        it("extracts paths for non-delete FieldValues", () => {
            const paths = extractTransformFields({
                count: FieldValue.increment(1),
                tags: FieldValue.arrayUnion("a"),
                timestamp: FieldValue.serverTimestamp(),
            });
            expect(paths).toContain("count");
            expect(paths).toContain("tags");
            expect(paths).toContain("timestamp");
            expect(paths).toHaveLength(3);
        });

        it("excludes delete fields", () => {
            const paths = extractTransformFields({
                count: FieldValue.increment(1),
                obsolete: FieldValue.delete(),
            });
            expect(paths).toContain("count");
            expect(paths).not.toContain("obsolete");
        });

        it("handles nested transforms", () => {
            const paths = extractTransformFields({
                stats: {
                    views: FieldValue.increment(1),
                },
            });
            expect(paths).toContain("stats.views");
        });
    });
});

// ============================================================================
// References Tests
// ============================================================================

import {
    CollectionReference,
    DocumentReference,
    DocumentSnapshotImpl,
} from "../src/references.js";

describe("references.ts", () => {
    describe("DocumentSnapshotImpl", () => {
        describe("get() method", () => {
            it("returns undefined for non-existent document", () => {
                const snap = new DocumentSnapshotImpl(null, "col/doc");
                expect(snap.get("anyField")).toBeUndefined();
                expect(snap.exists).toBe(false);
            });

            it("returns top-level field value", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {
                            name: { stringValue: "Alice" },
                            age: { integerValue: "30" },
                        },
                    },
                    "users/user1",
                );
                expect(snap.get("name")).toBe("Alice");
                expect(snap.get("age")).toBe(30);
            });

            it("returns nested field value with dot notation", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {
                            user: {
                                mapValue: {
                                    fields: {
                                        profile: {
                                            mapValue: {
                                                fields: {
                                                    name: {
                                                        stringValue: "Bob",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "docs/doc1",
                );
                expect(snap.get("user.profile.name")).toBe("Bob");
            });

            it("returns undefined for non-existent nested path", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {
                            user: { mapValue: { fields: {} } },
                        },
                    },
                    "docs/doc1",
                );
                expect(snap.get("user.missing.path")).toBeUndefined();
            });

            it("returns undefined when traversing through non-object", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {
                            name: { stringValue: "test" },
                        },
                    },
                    "docs/doc1",
                );
                expect(snap.get("name.nested")).toBeUndefined();
            });

            it("returns undefined when traversing through null", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {
                            data: { nullValue: null },
                        },
                    },
                    "docs/doc1",
                );
                expect(snap.get("data.nested")).toBeUndefined();
            });
        });

        describe("metadata", () => {
            it("parses createTime and updateTime", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {},
                        createTime: "2024-01-15T12:00:00.000Z",
                        updateTime: "2024-01-16T12:00:00.000Z",
                    },
                    "docs/doc1",
                );
                expect(snap.createTime).toBeInstanceOf(Date);
                expect(snap.updateTime).toBeInstanceOf(Date);
                expect(snap.createTime?.toISOString()).toBe(
                    "2024-01-15T12:00:00.000Z",
                );
            });

            it("handles missing timestamps", () => {
                const snap = new DocumentSnapshotImpl(
                    {
                        name: "test",
                        fields: {},
                    },
                    "docs/doc1",
                );
                expect(snap.createTime).toBeUndefined();
                expect(snap.updateTime).toBeUndefined();
            });
        });
    });

    describe("DocumentReference", () => {
        // Mock Firestore client for testing
        const mockFirestore = {
            _getDocument: async () => null,
            _getDocumentName: (path: string) => `mock/path/${path}`,
            _setDocument: async () => ({}),
            _updateDocument: async () => ({}),
            _deleteDocument: async () => {},
            _runQuery: async () => [],
            _runAggregationQuery: async () => ({
                result: { aggregateFields: {} },
                readTime: new Date().toISOString(),
            }),
        };

        it("parent returns CollectionReference", () => {
            const docRef = new DocumentReference(mockFirestore, "users/user1");
            const parent = docRef.parent;
            expect(parent).toBeInstanceOf(CollectionReference);
            expect(parent.path).toBe("users");
            expect(parent.id).toBe("users");
        });

        it("parent handles nested paths", () => {
            const docRef = new DocumentReference(
                mockFirestore,
                "users/user1/posts/post1",
            );
            const parent = docRef.parent;
            expect(parent.path).toBe("users/user1/posts");
            expect(parent.id).toBe("posts");
        });

        it("collection returns subcollection reference", () => {
            const docRef = new DocumentReference(mockFirestore, "users/user1");
            const subCol = docRef.collection("posts");
            expect(subCol).toBeInstanceOf(CollectionReference);
            expect(subCol.path).toBe("users/user1/posts");
        });
    });

    describe("CollectionReference", () => {
        const mockFirestore = {
            _getDocument: async () => null,
            _getDocumentName: (path: string) => `mock/path/${path}`,
            _setDocument: async () => ({}),
            _updateDocument: async () => ({}),
            _deleteDocument: async () => {},
            _runQuery: async () => [],
            _runAggregationQuery: async () => ({
                result: { aggregateFields: {} },
                readTime: new Date().toISOString(),
            }),
        };

        it("doc without ID generates random ID", () => {
            const colRef = new CollectionReference(mockFirestore, "users");
            const docRef = colRef.doc();
            expect(docRef.id).toHaveLength(20);
            expect(docRef.path).toMatch(/^users\/[A-Za-z0-9]{20}$/);
        });

        it("doc with ID uses provided ID", () => {
            const colRef = new CollectionReference(mockFirestore, "users");
            const docRef = colRef.doc("specific-id");
            expect(docRef.id).toBe("specific-id");
            expect(docRef.path).toBe("users/specific-id");
        });
    });
});

// ============================================================================
// Transaction Tests
// ============================================================================

import { Transaction } from "../src/transaction.js";

describe("transaction.ts", () => {
    // Mock Firestore client for transaction testing
    const createMockFirestore = () => ({
        _getDocument: async () => null,
        _getDocumentName: (path: string) =>
            `projects/test/databases/(default)/documents/${path}`,
        _setDocument: async () => ({}),
        _updateDocument: async () => ({}),
        _deleteDocument: async () => {},
        _runQuery: async () => [],
        _runAggregationQuery: async () => ({
            result: { aggregateFields: {} },
            readTime: new Date().toISOString(),
        }),
    });

    describe("set with merge option", () => {
        it("creates write with updateMask when merge is true", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "test-transaction-id");
            const docRef = new DocumentReference(mockFs, "users/user1");

            txn.set(docRef, { name: "Alice", age: 30 }, { merge: true });

            const writes = txn._getWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0].updateMask).toBeDefined();
            expect(writes[0].updateMask?.fieldPaths).toContain("name");
            expect(writes[0].updateMask?.fieldPaths).toContain("age");
        });

        it("creates write without updateMask when merge is false", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "test-transaction-id");
            const docRef = new DocumentReference(mockFs, "users/user1");

            txn.set(docRef, { name: "Bob" });

            const writes = txn._getWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0].updateMask).toBeUndefined();
        });
    });

    describe("set with transforms", () => {
        it("includes updateTransforms for FieldValue sentinels", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "test-transaction-id");
            const docRef = new DocumentReference(mockFs, "users/user1");

            txn.set(docRef, {
                name: "Charlie",
                count: FieldValue.increment(1),
            });

            const writes = txn._getWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0].updateTransforms).toBeDefined();
            expect(writes[0].updateTransforms).toHaveLength(1);
            expect(writes[0].updateTransforms![0].fieldPath).toBe("count");
        });
    });

    describe("update with transforms", () => {
        it("includes updateTransforms for increment", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "test-transaction-id");
            const docRef = new DocumentReference(mockFs, "counter/counter1");

            txn.update(docRef, {
                value: FieldValue.increment(5),
            });

            const writes = txn._getWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0].updateTransforms).toBeDefined();
            expect(writes[0].updateTransforms![0].increment).toEqual({
                integerValue: "5",
            });
        });

        it("handles delete fields in update", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "test-transaction-id");
            const docRef = new DocumentReference(mockFs, "docs/doc1");

            txn.update(docRef, {
                keepField: "value",
                removeField: FieldValue.delete(),
            });

            const writes = txn._getWrites();
            expect(writes).toHaveLength(1);
            // The updateMask should include both fields
            expect(writes[0].updateMask?.fieldPaths).toContain("keepField");
            expect(writes[0].updateMask?.fieldPaths).toContain("removeField");
        });
    });

    describe("_getTransactionId", () => {
        it("returns the transaction ID", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "my-transaction-123");
            expect(txn._getTransactionId()).toBe("my-transaction-123");
        });
    });

    describe("chaining", () => {
        it("returns this for chaining", () => {
            const mockFs = createMockFirestore();
            const txn = new Transaction(mockFs, "test-txn");
            const docRef1 = new DocumentReference(mockFs, "docs/doc1");
            const docRef2 = new DocumentReference(mockFs, "docs/doc2");

            const result = txn
                .set(docRef1, { a: 1 })
                .update(docRef2, { b: 2 })
                .delete(docRef1);

            expect(result).toBe(txn);
            expect(txn._getWrites()).toHaveLength(3);
        });
    });
});
