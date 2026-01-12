/**
 * Query Integration Tests
 *
 * These tests run against a real Firestore instance.
 * Requires .env file with FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Firestore } from "../src/index.js";

config();

const ENABLED = !!(
    process.env.FIRESTORE_EMULATOR_HOST ||
    (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY)
);
const COLLECTION = "fires2rest-query-testing";

/** Test document type */
interface TestUser {
    name: string;
    age: number;
    score: number;
    tags: string[];
    active: boolean;
}

describe.skipIf(!ENABLED)("Query Integration Tests", () => {
    let db: Firestore;
    const createdDocs: string[] = [];

    beforeAll(async () => {
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

        // Create test documents
        const testData = [
            {
                name: "Alice",
                age: 30,
                score: 85,
                tags: ["admin", "user"],
                active: true,
            },
            { name: "Bob", age: 25, score: 92, tags: ["user"], active: true },
            {
                name: "Charlie",
                age: 35,
                score: 78,
                tags: ["mod", "user"],
                active: false,
            },
            {
                name: "Diana",
                age: 28,
                score: 95,
                tags: ["admin"],
                active: true,
            },
            { name: "Eve", age: 32, score: 88, tags: ["user"], active: true },
        ];

        for (let i = 0; i < testData.length; i++) {
            const docRef = db.collection(COLLECTION).doc(`user-${i + 1}`);
            await docRef.set(testData[i]);
            createdDocs.push(docRef.path);
        }
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

    describe("where() filters", () => {
        it("filters with equality", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("name", "==", "Alice")
                .get();

            expect(snapshot.size).toBe(1);
            expect(snapshot.docs[0].data().name).toBe("Alice");
        });

        it("filters with greater than", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("age", ">", 30)
                .get();

            expect(snapshot.size).toBe(2);
            const ages = snapshot.docs.map(
                (d) => (d.data() as unknown as TestUser).age,
            );
            expect(ages.every((age) => age > 30)).toBe(true);
        });

        it("filters with greater than or equal", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("age", ">=", 30)
                .get();

            expect(snapshot.size).toBe(3);
            const ages = snapshot.docs.map(
                (d) => (d.data() as unknown as TestUser).age,
            );
            expect(ages.every((age) => age >= 30)).toBe(true);
        });

        it("filters with less than", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("age", "<", 30)
                .get();

            expect(snapshot.size).toBe(2);
            const ages = snapshot.docs.map(
                (d) => (d.data() as unknown as TestUser).age,
            );
            expect(ages.every((age) => age < 30)).toBe(true);
        });

        it("filters with less than or equal", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("age", "<=", 30)
                .get();

            expect(snapshot.size).toBe(3);
            const ages = snapshot.docs.map(
                (d) => (d.data() as unknown as TestUser).age,
            );
            expect(ages.every((age) => age <= 30)).toBe(true);
        });

        it("filters with not equal", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("active", "!=", false)
                .get();

            expect(snapshot.size).toBe(4);
            snapshot.docs.forEach((doc) => {
                expect(doc.data().active).toBe(true);
            });
        });

        it("filters with array-contains", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("tags", "array-contains", "admin")
                .get();

            expect(snapshot.size).toBe(2);
            snapshot.docs.forEach((doc) => {
                expect(doc.data().tags).toContain("admin");
            });
        });

        it("filters with in operator", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("name", "in", ["Alice", "Bob"])
                .get();

            expect(snapshot.size).toBe(2);
            const names = snapshot.docs.map((d) => d.data().name);
            expect(names).toContain("Alice");
            expect(names).toContain("Bob");
        });

        // NOTE: This test requires a composite index (active + age) to be created in Firebase Console
        it("combines multiple where clauses (requires composite index)", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("active", "==", true)
                .where("age", ">", 28)
                .get();

            expect(snapshot.size).toBe(2);
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                expect(data.active).toBe(true);
                expect(data.age).toBeGreaterThan(28);
            });
        });
    });

    describe("orderBy()", () => {
        it("orders by field ascending", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("age", "asc")
                .get();

            const ages = snapshot.docs.map(
                (d) => (d.data() as unknown as TestUser).age,
            );
            for (let i = 1; i < ages.length; i++) {
                expect(ages[i]).toBeGreaterThanOrEqual(ages[i - 1]);
            }
        });

        it("orders by field descending", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("score", "desc")
                .get();

            const scores = snapshot.docs.map(
                (d) => (d.data() as unknown as TestUser).score,
            );
            for (let i = 1; i < scores.length; i++) {
                expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
            }
        });
    });

    describe("limit() and offset()", () => {
        it("limits results", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("name")
                .limit(3)
                .get();

            expect(snapshot.size).toBe(3);
        });

        it("limits to last results", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("name")
                .limitToLast(3)
                .get();

            expect(snapshot.size).toBe(3);
            // With limitToLast(3) and orderBy("name"), it should be the last 3 alphabetically
            // Alice, Bob, Charlie, Diana, Eve
            // Last 3: Charlie, Diana, Eve
            const names = snapshot.docs.map((d) => d.data().name);
            expect(names).toContain("Charlie");
            expect(names).toContain("Diana");
            expect(names).toContain("Eve");
            // They should also be in the original order (ABC order) because we reverse them back in SDK
            expect(names[0]).toBe("Charlie");
            expect(names[1]).toBe("Diana");
            expect(names[2]).toBe("Eve");
        });

        it("offsets results", async () => {
            const allSnapshot = await db
                .collection(COLLECTION)
                .orderBy("name")
                .get();

            const offsetSnapshot = await db
                .collection(COLLECTION)
                .orderBy("name")
                .offset(2)
                .get();

            expect(offsetSnapshot.size).toBe(allSnapshot.size - 2);
            expect(offsetSnapshot.docs[0].data().name).toBe(
                allSnapshot.docs[2].data().name,
            );
        });

        it("combines limit and offset for pagination", async () => {
            const page1 = await db
                .collection(COLLECTION)
                .orderBy("name")
                .limit(2)
                .get();

            const page2 = await db
                .collection(COLLECTION)
                .orderBy("name")
                .offset(2)
                .limit(2)
                .get();

            expect(page1.size).toBe(2);
            expect(page2.size).toBe(2);

            const page1Names = page1.docs.map((d) => d.data().name);
            const page2Names = page2.docs.map((d) => d.data().name);

            // Pages should not overlap
            page2Names.forEach((name) => {
                expect(page1Names).not.toContain(name);
            });
        });
    });

    describe("cursor pagination", () => {
        it("uses startAt for cursor pagination", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("age")
                .startAt(30)
                .get();

            snapshot.docs.forEach((doc) => {
                expect(doc.data().age).toBeGreaterThanOrEqual(30);
            });
        });

        it("uses startAfter for cursor pagination", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("age")
                .startAfter(30)
                .get();

            snapshot.docs.forEach((doc) => {
                expect(doc.data().age).toBeGreaterThan(30);
            });
        });

        it("uses endAt for cursor pagination", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("age")
                .endAt(30)
                .get();

            snapshot.docs.forEach((doc) => {
                expect(doc.data().age).toBeLessThanOrEqual(30);
            });
        });

        it("uses endBefore for cursor pagination", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("age")
                .endBefore(30)
                .get();

            snapshot.docs.forEach((doc) => {
                expect(doc.data().age).toBeLessThan(30);
            });
        });

        it("combines startAt and endAt for range queries", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .orderBy("age")
                .startAt(28)
                .endAt(32)
                .get();

            snapshot.docs.forEach((doc) => {
                const age = doc.data().age;
                expect(age).toBeGreaterThanOrEqual(28);
                expect(age).toBeLessThanOrEqual(32);
            });
        });
    });

    describe("select()", () => {
        it("projects specific fields", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .select("name", "age")
                .limit(1)
                .get();

            expect(snapshot.size).toBe(1);
            const data = snapshot.docs[0].data();
            expect(data.name).toBeDefined();
            expect(data.age).toBeDefined();
            // Note: Other fields may still be present depending on Firestore behavior
        });
    });

    describe("count()", () => {
        it("counts all documents", async () => {
            const snapshot = await db.collection(COLLECTION).count();

            expect(snapshot.data().count).toBe(5);
        });

        it("counts filtered documents", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("active", "==", true)
                .count();

            expect(snapshot.data().count).toBe(4);
        });
    });

    describe("QuerySnapshot", () => {
        it("provides isEmpty and size", async () => {
            const snapshot = await db.collection(COLLECTION).get();

            expect(snapshot.empty).toBe(false);
            expect(snapshot.size).toBe(5);
        });

        it("provides forEach", async () => {
            const snapshot = await db.collection(COLLECTION).limit(2).get();
            const names: string[] = [];

            snapshot.forEach((doc) => {
                names.push((doc.data() as unknown as TestUser).name);
            });

            expect(names).toHaveLength(2);
        });
    });

    describe("QueryDocumentSnapshot", () => {
        it("provides id and path", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("name", "==", "Alice")
                .get();

            expect(snapshot.docs[0].id).toBe("user-1");
            expect(snapshot.docs[0].path).toBe(`${COLLECTION}/user-1`);
        });

        it("provides exists = true", async () => {
            const snapshot = await db.collection(COLLECTION).limit(1).get();

            expect(snapshot.docs[0].exists).toBe(true);
        });

        it("provides data() method", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("name", "==", "Alice")
                .get();

            const data = snapshot.docs[0].data();
            expect(data.name).toBe("Alice");
            expect(data.age).toBe(30);
        });
    });

    describe("complex queries", () => {
        // NOTE: This test requires a composite index (active + score) to be created in Firebase Console
        it("combines where, orderBy, and limit (requires composite index)", async () => {
            const snapshot = await db
                .collection(COLLECTION)
                .where("active", "==", true)
                .orderBy("score", "desc")
                .limit(3)
                .get();

            expect(snapshot.size).toBe(3);
            snapshot.docs.forEach((doc) => {
                expect((doc.data() as unknown as TestUser).active).toBe(true);
            });

            const scores = snapshot.docs
                .map((d) => d.data() as unknown as TestUser)
                .map((u) => u.score);
            for (let i = 1; i < scores.length; i++) {
                expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
            }
        });
    });
});
