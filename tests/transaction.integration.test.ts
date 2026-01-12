/**
 * Transaction Integration Tests
 *
 * These tests run against a real Firestore instance (or the emulator).
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
const COLLECTION = "fires2rest-transaction-testing";

/** Test document type */
interface TestUser {
    name: string;
    age: number;
    score: number;
    tags: string[];
    active: boolean;
}

describe.skipIf(!ENABLED)("Transaction Integration Tests", () => {
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

        // Create deterministic test documents
        const testData: Array<TestUser> = [
            {
                name: "Alice",
                age: 30,
                score: 10,
                tags: ["user"],
                active: true,
            },
            {
                name: "Bob",
                age: 25,
                score: 20,
                tags: ["user"],
                active: true,
            },
            {
                name: "Cathy",
                age: 28,
                score: 30,
                tags: ["user"],
                active: true,
            },
            {
                name: "Dan",
                age: 40,
                score: 100,
                tags: ["vip"],
                active: true,
            },
            {
                name: "Eve",
                age: 33,
                score: 999,
                tags: ["inactive"],
                active: false,
            },
        ];

        for (let i = 0; i < testData.length; i++) {
            const docRef = db.collection(COLLECTION).doc(`user-${i + 1}`);
            await docRef.set(testData[i] as unknown as Record<string, unknown>);
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

    describe("complex transaction", () => {
        it("increases below-average active users by 10", async () => {
            // Get active docs
            const activeSnapshot = await db
                .collection(COLLECTION)
                .where("active", "==", true)
                .get();

            expect(activeSnapshot.empty).toBe(false);

            const activeRefs = activeSnapshot.docs.map((d) => db.doc(d.path));

            // Run the transaction: read all docs first, compute avg, then write.
            const { avgScore, originals } = await db.runTransaction(
                async (txn) => {
                    const originalsInner: Record<string, number> = {};
                    let total = 0;

                    for (const ref of activeRefs) {
                        const snap = await txn.get(ref);
                        const score = (
                            snap.data() as unknown as TestUser | undefined
                        )?.score;
                        expect(typeof score).toBe("number");
                        originalsInner[ref.path] = score as number;
                        total += score as number;
                    }

                    const avg = total / activeRefs.length;

                    for (const ref of activeRefs) {
                        const score = originalsInner[ref.path];
                        if (score < avg) {
                            txn.update(ref, { score: score + 10 });
                        }
                    }

                    return { avgScore: avg, originals: originalsInner };
                },
            );

            // Verify post-commit state
            for (const ref of activeRefs) {
                const snap = await ref.get();
                const data = snap.data() as unknown as TestUser | undefined;
                expect(data?.active).toBe(true);

                const before = originals[ref.path];
                const after = data?.score;
                expect(typeof after).toBe("number");

                if (before < avgScore) {
                    expect(after).toBe(before + 10);
                } else {
                    expect(after).toBe(before);
                }
            }

            // Inactive doc should remain unchanged
            const inactiveRef = db.collection(COLLECTION).doc("user-5");
            const inactiveSnap = await inactiveRef.get();
            const inactiveData = inactiveSnap.data() as unknown as
                | TestUser
                | undefined;
            expect(inactiveData?.active).toBe(false);
            expect(inactiveData?.score).toBe(999);
        });
    });
});
