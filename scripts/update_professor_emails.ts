/**
 * scripts/update_professor_emails.ts
 * Updates email field on existing professor docs in Firestore.
 * Source: UW Bothell CSS department faculty directory.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/update_professor_emails.ts
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

const professorEmails: Record<string, string> = {
  // Full-time faculty
  "anderson_laurie": "lja3@uw.edu",
  "asuncion_hazeline": "hazeline@uw.edu",
  "ayhan_murat": "msayhan@uw.edu",
  "champion_kaylea": "kaylea@uw.edu",
  "champion_mia": "miachamp@uw.edu",
  "chen_min": "minchen2@uw.edu",
  "dailey_dharma": "ddailey@uw.edu",
  "dupuis_marc": "marcjd@uw.edu",
  "fukuda_munehiro": "mfukuda@uw.edu",
  "kim_jeffrey": "jykim@uw.edu",
  "kim_wooyoung": "kimw6@uw.edu",
  "kool_nancy": "nlkool@uw.edu",
  "lagesse_brent": "lagesse@uw.edu",
  "lin_johnny": "jwblin@uw.edu",
  "mashhadi_afra": "mashhadi@uw.edu",
  "olson_clark": "cfolson@uw.edu",
  "parsons_erika": "efuente@uw.edu",
  "peng_yang": "yangpeng@uw.edu",
  "pisan_yusuf": "pisan@uw.edu",
  "retik_arkady": "aretik@uw.edu",
  "rubin_zachary": "zarubin@uw.edu",
  "si_dong": "dongsi@uw.edu",
  "stiber_michael": "stiber@uw.edu",
  "stride_jeff": "jstride@uw.edu",
  "sung_kelvin": "ksung@uw.edu",
  "thamilarasu_geethapriya": "geetha@uw.edu",
  "zolyomi_annuska": "annuska@uw.edu",
  // Part-time lecturers
  "chini_morteza": "chinim@uw.edu",
  "shaw_carol": "shawca@uw.edu",
  // Affiliated faculty
  "brechner_eric": "ericbrec@uw.edu",
  "gavriliu_marcel": "mgav@uw.edu",
  "gruenbaum_peter": "pgruen@uw.edu",
  "haque_mohammad": "haque@uw.edu",
  "lidster_william": "wlidster@uw.edu",
  "melnikoff_steve": "stevexm@uw.edu",
  "uong_ethan": "etuong@uw.edu",
};

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const [docId, email] of Object.entries(professorEmails)) {
    const ref = db.collection("professors").doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`⚠️  Skipped (not in Firestore): ${docId}`);
      skipped++;
      continue;
    }

    await ref.update({ email });
    console.log(`✅  ${docId} → ${email}`);
    updated++;
  }

  console.log(`\n✨ Done. ${updated} updated, ${skipped} skipped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
