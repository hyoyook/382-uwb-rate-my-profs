/**
 * scripts/recalculate_aggregates.ts
 * Manually invoked to recompute overall_rating and ratings_count for all professors
 * by reading the live reviews collection. 
 * Created to accompany tests
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/recalculate_aggregates.ts
 *
 * Optionally recalculate a single professor:
 *   npx ts-node --project tsconfig.seed.json scripts/recalculate_aggregates.ts pisan_yusuf
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

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

async function recalculate(professorId?: string) {
  // Get professors to process
  let professorIds: string[] = [];

  if (professorId) {
    professorIds = [professorId];
    console.log(`\n🔍 Recalculating for: ${professorId}\n`);
  } else {
    const snap = await db.collection("professors").get();
    professorIds = snap.docs.map((d) => d.id);
    console.log(`\n🔍 Recalculating for all ${professorIds.length} professors\n`);
  }

  let updated = 0;
  let skipped = 0;

  for (const profId of professorIds) {
    const reviewsSnap = await db
      .collection("reviews")
      .where("professor_id", "==", profId)
      .get();

    const count = reviewsSnap.size;
    const avg =
      count > 0
        ? Math.round(
          (reviewsSnap.docs.reduce(
            (sum, d) => sum + ((d.data().scores?.overall as number) ?? 0),
            0
          ) /
            count) *
          10
        ) / 10
        : 0;

    await db.collection("professors").doc(profId).update({
      ratings_count: count,
      overall_rating: avg,
    });

    if (count > 0) {
      console.log(`  ✅ ${profId}: ${avg} avg over ${count} review${count !== 1 ? "s" : ""}`);
      updated++;
    } else {
      console.log(`  ○  ${profId}: 0 reviews — reset to 0`);
      skipped++;
    }
  }

  console.log(`\n✨ Done. ${updated} updated, ${skipped} reset to 0.\n`);
  process.exit(0);
}

const targetId = process.argv[2];
recalculate(targetId).catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
