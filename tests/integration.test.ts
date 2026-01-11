/**
 * Integration Tests
 *
 * These tests run against a real Firestore instance.
 * Requires .env file with FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FieldValue, Firestore } from "../src/index.js";

config();

const ENABLED = !!(
    process.env.FIRESTORE_EMULATOR_HOST ||
    (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY)
);
const COLLECTION = "fires2rest-testing";

describe.skipIf(!ENABLED)("Integration Tests", () => {
    let db: Firestore;
    const createdDocs: string[] = [];

    beforeAll(() => {
        db = process.env.FIRESTORE_EMULATOR_HOST
            ? Firestore.useEmulator({
                  emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
              })
            : Firestore.useServiceAccount(process.env.FIREBASE_PROJECT_ID!, {
                  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
                      /\\n/g,
                      "\n",
                  )!,
              });
    });

    afterAll(async () => {
        // Cleanup created documents
        for (const docPath of createdDocs) {
            try {
                await db.doc(docPath).delete();
            } catch {
                // Ignore cleanup errors
            }
        }
    });

    describe("Document CRUD", () => {
        it("creates and reads a document", async () => {
            const docRef = db.collection(COLLECTION).doc("test-crud-1");
            createdDocs.push(docRef.path);

            await docRef.set({
                name: "Test Document",
                count: 42,
                active: true,
                tags: ["a", "b", "c"],
            });

            const snap = await docRef.get();
            expect(snap.exists).toBe(true);
            expect(snap.data()).toEqual({
                name: "Test Document",
                count: 42,
                active: true,
                tags: ["a", "b", "c"],
            });
        });

        it("updates a document", async () => {
            const docRef = db.collection(COLLECTION).doc("test-crud-2");
            createdDocs.push(docRef.path);

            await docRef.set({ name: "Original", value: 1 });
            await docRef.update({ value: 2, newField: "added" });

            const snap = await docRef.get();
            expect(snap.data()).toEqual({
                name: "Original",
                value: 2,
                newField: "added",
            });
        });

        it("deletes a document", async () => {
            const docRef = db.collection(COLLECTION).doc("test-crud-3");

            await docRef.set({ name: "ToDelete" });
            await docRef.delete();

            const snap = await docRef.get();
            expect(snap.exists).toBe(false);
        });

        it("handles non-existent document", async () => {
            const docRef = db
                .collection(COLLECTION)
                .doc("non-existent-doc-xyz");
            const snap = await docRef.get();
            expect(snap.exists).toBe(false);
            expect(snap.data()).toBeUndefined();
        });
    });

    describe("FieldValue Operations", () => {
        it("uses serverTimestamp", async () => {
            const docRef = db.collection(COLLECTION).doc("test-timestamp");
            createdDocs.push(docRef.path);

            await docRef.set({
                name: "Timestamp Test",
                createdAt: FieldValue.serverTimestamp(),
            });

            const snap = await docRef.get();
            const data = snap.data();
            expect(data?.createdAt).toBeInstanceOf(Date);
        });

        it("uses increment", async () => {
            const docRef = db.collection(COLLECTION).doc("test-increment");
            createdDocs.push(docRef.path);

            await docRef.set({ count: 10 });
            await docRef.update({ count: FieldValue.increment(5) });

            const snap = await docRef.get();
            expect(snap.data()?.count).toBe(15);
        });

        it("uses arrayUnion", async () => {
            const docRef = db.collection(COLLECTION).doc("test-array-union");
            createdDocs.push(docRef.path);

            await docRef.set({ tags: ["a", "b"] });
            await docRef.update({ tags: FieldValue.arrayUnion("c", "d") });

            const snap = await docRef.get();
            expect(snap.data()?.tags).toEqual(["a", "b", "c", "d"]);
        });

        it("uses arrayRemove", async () => {
            const docRef = db.collection(COLLECTION).doc("test-array-remove");
            createdDocs.push(docRef.path);

            await docRef.set({ tags: ["a", "b", "c"] });
            await docRef.update({ tags: FieldValue.arrayRemove("b") });

            const snap = await docRef.get();
            expect(snap.data()?.tags).toEqual(["a", "c"]);
        });

        it("uses delete", async () => {
            const docRef = db.collection(COLLECTION).doc("test-delete-field");
            createdDocs.push(docRef.path);

            await docRef.set({ name: "Test", obsolete: "remove me" });
            await docRef.update({ obsolete: FieldValue.delete() });

            const snap = await docRef.get();
            expect(snap.data()).toEqual({ name: "Test" });
        });
    });

    describe("Transactions", () => {
        it("performs read-write transaction", async () => {
            const docRef = db.collection(COLLECTION).doc("test-transaction-1");
            createdDocs.push(docRef.path);

            await docRef.set({ balance: 100 });

            const result = await db.runTransaction(async (txn) => {
                const snap = await txn.get(docRef);
                const balance = (snap.data()?.balance ?? 0) as number;
                const newBalance = balance - 30;
                txn.update(docRef, { balance: newBalance });
                return newBalance;
            });

            expect(result).toBe(70);

            const snap = await docRef.get();
            expect(snap.data()?.balance).toBe(70);
        });

        it("performs multi-document transaction", async () => {
            const doc1 = db.collection(COLLECTION).doc("test-txn-multi-1");
            const doc2 = db.collection(COLLECTION).doc("test-txn-multi-2");
            createdDocs.push(doc1.path, doc2.path);

            await doc1.set({ value: 50 });
            await doc2.set({ value: 50 });

            // Transfer 20 from doc1 to doc2
            await db.runTransaction(async (txn) => {
                const snap1 = await txn.get(doc1);
                const snap2 = await txn.get(doc2);

                const val1 = (snap1.data()?.value ?? 0) as number;
                const val2 = (snap2.data()?.value ?? 0) as number;

                txn.update(doc1, { value: val1 - 20 });
                txn.update(doc2, { value: val2 + 20 });
            });

            const snap1 = await doc1.get();
            const snap2 = await doc2.get();

            expect(snap1.data()?.value).toBe(30);
            expect(snap2.data()?.value).toBe(70);
        });

        it("transaction can create and delete documents", async () => {
            const newDoc = db.collection(COLLECTION).doc("test-txn-create");
            const deleteDoc = db.collection(COLLECTION).doc("test-txn-delete");
            createdDocs.push(newDoc.path);

            await deleteDoc.set({ toDelete: true });

            await db.runTransaction(async (txn) => {
                txn.set(newDoc, { created: true });
                txn.delete(deleteDoc);
            });

            const newSnap = await newDoc.get();
            const deleteSnap = await deleteDoc.get();

            expect(newSnap.exists).toBe(true);
            expect(deleteSnap.exists).toBe(false);
        });
    });

    describe("Collection Operations", () => {
        it("adds document with auto-generated ID", async () => {
            const colRef = db.collection(COLLECTION);
            const docRef = await colRef.add({ autoGenerated: true });
            createdDocs.push(docRef.path);

            expect(docRef.id).toHaveLength(20);

            const snap = await docRef.get();
            expect(snap.exists).toBe(true);
            expect(snap.data()?.autoGenerated).toBe(true);
        });
    });

    describe("Nested Data", () => {
        it("handles nested objects", async () => {
            const docRef = db.collection(COLLECTION).doc("test-nested");
            createdDocs.push(docRef.path);

            await docRef.set({
                user: {
                    name: "Alice",
                    profile: {
                        age: 30,
                        city: "NYC",
                    },
                },
                metadata: {
                    version: 1,
                },
            });

            const snap = await docRef.get();
            const data = snap.data() as {
                user?: { profile?: { city?: string } };
            };
            expect(data?.user?.profile?.city).toBe("NYC");
        });

        it("updates nested fields", async () => {
            const docRef = db.collection(COLLECTION).doc("test-nested-update");
            createdDocs.push(docRef.path);

            await docRef.set({
                user: { name: "Bob", age: 25 },
            });

            await docRef.update({
                "user.age": 26,
            });

            const snap = await docRef.get();
            const data = snap.data() as {
                user?: { age?: number; name?: string };
            };
            expect(data?.user?.age).toBe(26);
            expect(data?.user?.name).toBe("Bob");
        });
    });
});
