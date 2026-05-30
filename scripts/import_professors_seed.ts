/**
 * scripts/import_professors_seed.ts
 * Imports stub professor docs from professors_seed_tacoma_seattle.json into Firestore.
 * Skips any doc that already exists to avoid overwriting real data.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/import_professors_seed.ts
 *
 * Place professors_seed_tacoma_seattle.json in the project root before running.
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
  const filePath = path.resolve(process.cwd(), "professors_seed_tacoma_seattle.json");
  if (!fs.existsSync(filePath)) {
    console.error("❌ professors_seed_tacoma_seattle.json not found in project root.");
    process.exit(1);
  }

  const professors = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`📊 Found ${professors.length} professors to import\n`);

  let written = 0;
  let skipped = 0;

  // Check existence one by one (can't batch-read), then batch-write new ones
  const toWrite: typeof professors = [];

  for (const prof of professors) {
    const snap = await db.collection("professors").doc(prof.id).get();
    if (snap.exists) {
      console.log(`⏭️  Skipped (already exists): ${prof.id}`);
      skipped++;
    } else {
      toWrite.push(prof);
    }
  }

  // Batch write new ones
  const BATCH_SIZE = 400;
  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const chunk = toWrite.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const prof of chunk) {
      const { id, ...data } = prof;
      batch.set(db.collection("professors").doc(id), data);
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  ✅ ${written} / ${toWrite.length} new professors written`);
  }

  console.log(`\n✨ Done. ${written} written, ${skipped} skipped (already existed).\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
