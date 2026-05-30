/**
 * scripts/import_rmp_reviews.ts
 * Imports unverified RMP seed reviews from rmp_seed_reviews.json into Firestore.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/import_rmp_reviews.ts
 *
 * Place rmp_seed_reviews.json in the project root before running.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

async function main() {
  const filePath = path.resolve(process.cwd(), "rmp_seed_reviews.json");
  if (!fs.existsSync(filePath)) {
    console.error("❌ rmp_seed_reviews.json not found in project root.");
    process.exit(1);
  }

  const reviews = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`📊 Found ${reviews.length} reviews to import\n`);

  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const chunk = reviews.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const review of chunk) {
      const { id, ...data } = review;
      const ref = db.collection("reviews").doc(id);
      batch.set(ref, {
        ...data,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  ✅ ${written} / ${reviews.length} reviews written`);
  }

  console.log("\n✨ RMP reviews import complete.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
