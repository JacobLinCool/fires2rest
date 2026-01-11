/**
 * Interoperability Tests
 *
 * Tests that demonstrate data written by fires2rest can be read by firebase-admin
 * and vice versa, proving full compatibility with Firestore.
 */

import { config } from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import {
    FieldValue as AdminFieldValue,
    getFirestore as getAdminFirestore,
} from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FieldValue, Firestore } from "../src/index.js";

config();

const ENABLED = !!(
    process.env.FIRESTORE_EMULATOR_HOST ||
    (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY)
);
const COLLECTION = "fires2rest-interop-testing";

describe.skipIf(!ENABLED)("Interoperability Tests", () => {
    let restClient: Firestore;
    let adminDb: ReturnType<typeof getAdminFirestore>;
    const createdDocs: string[] = [];

    beforeAll(() => {
        // Initialize fires2rest client
        restClient = process.env.FIRESTORE_EMULATOR_HOST
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

        // Initialize firebase-admin client
        const app = initializeApp(
            process.env.FIRESTORE_EMULATOR_HOST
                ? {
                      projectId: "demo-no-project",
                  }
                : {
                      credential: cert({
                          projectId: process.env.FIREBASE_PROJECT_ID!,
                          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
                              /\\n/g,
                              "\n",
                          )!,
                      }),
                  },
            "interop-test-app",
        );
        adminDb = getAdminFirestore(app);
    });

    afterAll(async () => {
        // Cleanup created documents using admin SDK
        for (const docPath of createdDocs) {
            try {
                await adminDb.doc(docPath).delete();
            } catch {
                // Ignore cleanup errors
            }
        }
    });

    describe("REST writes, Admin reads", () => {
        it("writes basic document with REST, reads with Admin", async () => {
            const docPath = `${COLLECTION}/rest-to-admin-basic`;
            createdDocs.push(docPath);

            // Write with fires2rest
            await restClient.doc(docPath).set({
                name: "REST Written",
                count: 42,
                active: true,
                tags: ["a", "b", "c"],
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.exists).toBe(true);
            expect(adminSnap.data()).toEqual({
                name: "REST Written",
                count: 42,
                active: true,
                tags: ["a", "b", "c"],
            });
        });

        it("writes nested document with REST, reads with Admin", async () => {
            const docPath = `${COLLECTION}/rest-to-admin-nested`;
            createdDocs.push(docPath);

            // Write with fires2rest
            await restClient.doc(docPath).set({
                user: {
                    profile: {
                        name: "Alice",
                        age: 30,
                    },
                    settings: {
                        theme: "dark",
                        notifications: true,
                    },
                },
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.exists).toBe(true);
            const data = adminSnap.data()!;
            expect(data.user.profile.name).toBe("Alice");
            expect(data.user.profile.age).toBe(30);
            expect(data.user.settings.theme).toBe("dark");
        });

        it("writes with REST serverTimestamp, reads valid timestamp with Admin", async () => {
            const docPath = `${COLLECTION}/rest-to-admin-timestamp`;
            createdDocs.push(docPath);

            // Write with fires2rest using serverTimestamp
            await restClient.doc(docPath).set({
                name: "Timestamped",
                createdAt: FieldValue.serverTimestamp(),
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.exists).toBe(true);
            const data = adminSnap.data()!;
            expect(data.name).toBe("Timestamped");
            expect(data.createdAt).toBeInstanceOf(
                require("firebase-admin/firestore").Timestamp,
            );
            // Verify timestamp is recent (within last 2 minutes to account for clock skew)
            const now = Date.now();
            const createdAtMs = data.createdAt.toMillis();
            expect(createdAtMs).toBeGreaterThan(now - 120000);
            expect(createdAtMs).toBeLessThan(now + 120000);
        });

        it("updates with REST increment, reads correct value with Admin", async () => {
            const docPath = `${COLLECTION}/rest-to-admin-increment`;
            createdDocs.push(docPath);

            // Create initial document
            await restClient.doc(docPath).set({ count: 10 });

            // Increment with fires2rest
            await restClient.doc(docPath).update({
                count: FieldValue.increment(5),
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.data()?.count).toBe(15);
        });

        it("updates with REST arrayUnion, reads correct array with Admin", async () => {
            const docPath = `${COLLECTION}/rest-to-admin-array`;
            createdDocs.push(docPath);

            // Create initial document
            await restClient.doc(docPath).set({ tags: ["a", "b"] });

            // ArrayUnion with fires2rest
            await restClient.doc(docPath).update({
                tags: FieldValue.arrayUnion("c", "d"),
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.data()?.tags).toEqual(["a", "b", "c", "d"]);
        });
    });

    describe("Admin writes, REST reads", () => {
        it("writes basic document with Admin, reads with REST", async () => {
            const docPath = `${COLLECTION}/admin-to-rest-basic`;
            createdDocs.push(docPath);

            // Write with firebase-admin
            await adminDb.doc(docPath).set({
                name: "Admin Written",
                count: 100,
                active: false,
                items: [1, 2, 3],
            });

            // Read with fires2rest
            const restSnap = await restClient.doc(docPath).get();
            expect(restSnap.exists).toBe(true);
            expect(restSnap.data()).toEqual({
                name: "Admin Written",
                count: 100,
                active: false,
                items: [1, 2, 3],
            });
        });

        it("writes nested document with Admin, reads with REST", async () => {
            const docPath = `${COLLECTION}/admin-to-rest-nested`;
            createdDocs.push(docPath);

            // Write with firebase-admin
            await adminDb.doc(docPath).set({
                config: {
                    level1: {
                        level2: {
                            value: "deep",
                        },
                    },
                },
            });

            // Read with fires2rest
            const restSnap = await restClient.doc(docPath).get();
            expect(restSnap.exists).toBe(true);
            const data = restSnap.data() as {
                config: { level1: { level2: { value: string } } };
            };
            expect(data.config.level1.level2.value).toBe("deep");
        });

        it("writes with Admin serverTimestamp, reads valid date with REST", async () => {
            const docPath = `${COLLECTION}/admin-to-rest-timestamp`;
            createdDocs.push(docPath);

            // Write with firebase-admin using serverTimestamp
            await adminDb.doc(docPath).set({
                name: "Admin Timestamped",
                updatedAt: AdminFieldValue.serverTimestamp(),
            });

            // Read with fires2rest
            const restSnap = await restClient.doc(docPath).get();
            expect(restSnap.exists).toBe(true);
            const data = restSnap.data() as { name: string; updatedAt: Date };
            expect(data.name).toBe("Admin Timestamped");
            expect(data.updatedAt).toBeInstanceOf(Date);
            // Verify timestamp is recent
            const now = Date.now();
            expect(data.updatedAt.getTime()).toBeGreaterThan(now - 60000);
        });

        it("updates with Admin increment, reads correct value with REST", async () => {
            const docPath = `${COLLECTION}/admin-to-rest-increment`;
            createdDocs.push(docPath);

            // Create and increment with firebase-admin
            await adminDb.doc(docPath).set({ score: 50 });
            await adminDb.doc(docPath).update({
                score: AdminFieldValue.increment(25),
            });

            // Read with fires2rest
            const restSnap = await restClient.doc(docPath).get();
            expect(restSnap.data()?.score).toBe(75);
        });
    });

    describe("Mixed operations", () => {
        it("REST creates, Admin updates, REST reads", async () => {
            const docPath = `${COLLECTION}/mixed-ops-1`;
            createdDocs.push(docPath);

            // Create with fires2rest
            await restClient.doc(docPath).set({
                status: "created",
                version: 1,
            });

            // Update with firebase-admin
            await adminDb.doc(docPath).update({
                status: "updated",
                version: AdminFieldValue.increment(1),
                updatedBy: "admin",
            });

            // Read with fires2rest
            const restSnap = await restClient.doc(docPath).get();
            const data = restSnap.data() as {
                status: string;
                version: number;
                updatedBy: string;
            };
            expect(data.status).toBe("updated");
            expect(data.version).toBe(2);
            expect(data.updatedBy).toBe("admin");
        });

        it("Admin creates, REST updates, Admin reads", async () => {
            const docPath = `${COLLECTION}/mixed-ops-2`;
            createdDocs.push(docPath);

            // Create with firebase-admin
            await adminDb.doc(docPath).set({
                title: "Original",
                views: 0,
            });

            // Update with fires2rest
            await restClient.doc(docPath).update({
                title: "Modified",
                views: FieldValue.increment(10),
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.data()?.title).toBe("Modified");
            expect(adminSnap.data()?.views).toBe(10);
        });

        it("concurrent writes from both clients merge correctly", async () => {
            const docPath = `${COLLECTION}/concurrent-writes`;
            createdDocs.push(docPath);

            // Create initial document
            await adminDb.doc(docPath).set({
                restField: null,
                adminField: null,
            });

            // Write different fields from each client
            await Promise.all([
                restClient.doc(docPath).update({ restField: "from REST" }),
                adminDb.doc(docPath).update({ adminField: "from Admin" }),
            ]);

            // Both fields should be set
            const snap = await adminDb.doc(docPath).get();
            expect(snap.data()?.restField).toBe("from REST");
            expect(snap.data()?.adminField).toBe("from Admin");
        });
    });

    describe("Transaction interoperability", () => {
        it("REST transaction creates doc readable by Admin", async () => {
            const docPath = `${COLLECTION}/txn-rest-to-admin`;
            createdDocs.push(docPath);

            // Create in a transaction with fires2rest
            await restClient.runTransaction(async (txn) => {
                txn.set(restClient.doc(docPath), {
                    transactionSource: "REST",
                    timestamp: FieldValue.serverTimestamp(),
                });
            });

            // Read with firebase-admin
            const adminSnap = await adminDb.doc(docPath).get();
            expect(adminSnap.exists).toBe(true);
            expect(adminSnap.data()?.transactionSource).toBe("REST");
        });

        it("Admin transaction creates doc readable by REST", async () => {
            const docPath = `${COLLECTION}/txn-admin-to-rest`;
            createdDocs.push(docPath);

            // Create in a transaction with firebase-admin
            await adminDb.runTransaction(async (txn) => {
                txn.set(adminDb.doc(docPath), {
                    transactionSource: "Admin",
                    data: { nested: true },
                });
            });

            // Read with fires2rest
            const restSnap = await restClient.doc(docPath).get();
            expect(restSnap.exists).toBe(true);
            expect(restSnap.data()?.transactionSource).toBe("Admin");
            const data = restSnap.data() as {
                data: { nested: boolean };
            };
            expect(data.data.nested).toBe(true);
        });
    });
});
