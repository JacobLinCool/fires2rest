import { config } from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { run } from "./shared";

config();

const app = initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
        ? {
              projectId: "demo-no-project",
          }
        : {
              credential: cert({
                  projectId: process.env.FIREBASE_PROJECT_ID,
                  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
                      /\\n/g,
                      "\n",
                  ),
              }),
          },
);

const db = getFirestore(app);

async function main() {
    await run(db, FieldValue);
}

main().catch(console.error);
