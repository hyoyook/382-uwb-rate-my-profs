/**
 * scripts/import_catalog.ts
 * Imports all 131 real UW Bothell professors from seed.json into Firestore,
 * then seeds stub reviews for Yusuf Pisan.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/import_catalog.ts
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * and FIREBASE_ADMIN_PRIVATE_KEY in your .env.local
 *
 * Place seed.json in the project root before running.
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

// ─── Types (seed.json shape) ──────────────────────────────────────────────────

type CatalogProfessor = {
  id: string;
  name: string;
  email: string;
  campus: string;                        // flat string in catalog
  department: string;
  courses: Record<string, string[]>;     // { "CSS343": ["WIN2026", ...] }
  iaSystemRatings: Record<string, never>;
  mostRecentTerm: string;
};

type SeedJson = {
  professors: CatalogProfessor[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert "CSS343" → "CSS 343" */
function formatCourseCode(code: string): string {
  return code.replace(/^([A-Z]+)(\d)/, "$1 $2");
}

/** Derive courses_taught array from the courses map */
function coursesTaught(courses: Record<string, string[]>): string[] {
  return Object.keys(courses)
    .map(formatCourseCode)
    .sort();
}

// ─── Stub reviews for Yusuf Pisan (real IASystem data) ───────────────────────

const PISAN_REVIEWS = [
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2026,
    scores: { overall: 5, difficulty: 4, clarity: 5, helpfulness: 5, would_take_again: true },
    body: "The class was genuinely stimulating. LeetCode problems in lecture kept me engaged and the weekly projects built real understanding of data structures. The whiteboard explanations were especially helpful — when the slides were dense, Prof. Pisan could always clarify on the board.",
    tags: ["engaging-lecturer", "project-based", "interview-prep"],
    author_netid: "iasystem_wi26_01", verified: true,
  },
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2026,
    scores: { overall: 4, difficulty: 5, clarity: 4, helpfulness: 4, would_take_again: true },
    body: "Very hard class but directly relevant to software engineering. Topics like trees, heaps, and design patterns were tough to grasp at first — some required significant outside study. In-class exercises and practice exams helped a lot. Start projects early.",
    tags: ["tough-grader", "industry-relevant", "interview-prep"],
    author_netid: "iasystem_wi26_02", verified: true,
  },
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2026,
    scores: { overall: 4, difficulty: 4, clarity: 4, helpfulness: 4, would_take_again: true },
    body: "Pisan's enthusiasm for the material comes through clearly. The LeetCode approach is unique and practical for job interviews. Exams are difficult — study hard and attend every lecture since the whiteboard walkthroughs aren't replicated in the slides.",
    tags: ["engaging-lecturer", "tough-grader", "participation-matters"],
    author_netid: "iasystem_wi26_03", verified: true,
  },
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2026,
    scores: { overall: 3, difficulty: 5, clarity: 3, helpfulness: 3, would_take_again: true },
    body: "Some topics near the end (FSMs, Turing machines) lacked the clear follow-along explanations that made earlier topics click. More worked examples on those would help. The final project was harder but useful for understanding how to plan a large codebase.",
    tags: ["tough-grader", "knowledgeable"],
    author_netid: "iasystem_wi26_04", verified: true,
  },
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2026,
    scores: { overall: 5, difficulty: 4, clarity: 5, helpfulness: 5, would_take_again: true },
    body: "One of the best CS classes I've taken. The Huffman, autocomplete, and movies projects pushed my understanding further than any other class. LeetCode sessions in class are genuinely fun. Highly recommend attending every lecture.",
    tags: ["project-based", "engaging-lecturer", "interview-prep"],
    author_netid: "iasystem_wi26_05", verified: true,
  },
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Spring", year: 2025,
    scores: { overall: 5, difficulty: 4, clarity: 5, helpfulness: 4, would_take_again: true },
    body: "Attend lectures — they're genuinely useful even if technically optional. He gives plenty of LeetCode practice so you understand material before applying it to assignments. Exams are difficult so study hard, but the class is worth it.",
    tags: ["participation-matters", "engaging-lecturer", "interview-prep"],
    author_netid: "rmp_stub_01", verified: false,
  },
  {
    course_code: "CSS 342", campus: "UW Bothell", quarter: "Winter", year: 2024,
    scores: { overall: 3, difficulty: 4, clarity: 3, helpfulness: 4, would_take_again: true },
    body: "Lectures were fine and the LeetCode exercises after each topic helped reinforce the material. Midterm was reasonable but the final was noticeably harder. Graded by projects and exams only — no homework. Accessible outside class.",
    tags: ["test-heavy", "accessible-outside-class"],
    author_netid: "rmp_stub_02", verified: false,
  },
  {
    course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2021,
    scores: { overall: 5, difficulty: 4, clarity: 5, helpfulness: 5, would_take_again: true },
    body: "If you want an easy A with no effort, don't take him. If you want a solid understanding of data structures, algorithms, and C++, absolutely take him. He cares about students and will make complex topics accessible. Be ready to work hard.",
    tags: ["engaging-lecturer", "caring", "tough-grader"],
    author_netid: "rmp_stub_05", verified: false,
  },
];

const PISAN_IASYSTEM = [
  {
    course_code: "CSS 343", section: "D", quarter: "Winter", year: 2026,
    responses: 35, enrollment: 36, overall_summative: 4.4, cei: 5.7,
    summative_items: { course_as_whole: 4.3, course_content: 4.4, instructor_contribution: 4.5, instructor_effectiveness: 4.3 },
    ai_summary: null,
  },
  {
    course_code: "CSS 430", section: "A", quarter: "Winter", year: 2026,
    responses: 29, enrollment: 32, overall_summative: 3.7, cei: 5.4,
    summative_items: { course_as_whole: 3.6, course_content: 3.6, instructor_contribution: 3.9, instructor_effectiveness: 3.8 },
    ai_summary: null,
  },
  {
    course_code: "CSS 430", section: "B", quarter: "Winter", year: 2026,
    responses: 36, enrollment: 39, overall_summative: 3.4, cei: 5.6,
    summative_items: { course_as_whole: 3.3, course_content: 3.4, instructor_contribution: 3.5, instructor_effectiveness: 3.3 },
    ai_summary: null,
  },
  {
    course_code: "CSS 430", section: "A", quarter: "Autumn", year: 2025,
    responses: 44, enrollment: 44, overall_summative: 3.7, cei: 5.7,
    summative_items: { course_as_whole: 3.8, course_content: 3.8, instructor_contribution: 3.7, instructor_effectiveness: 3.6 },
    ai_summary: null,
  },
  {
    course_code: "CSS 343", section: "B", quarter: "Autumn", year: 2025,
    responses: 21, enrollment: 28, overall_summative: 3.5, cei: 4.9,
    summative_items: { course_as_whole: 3.3, course_content: 3.4, instructor_contribution: 3.9, instructor_effectiveness: 3.6 },
    ai_summary: null,
  },
  {
    course_code: "CSS 343", section: "A", quarter: "Autumn", year: 2025,
    responses: 32, enrollment: 39, overall_summative: 2.9, cei: 5.4,
    summative_items: { course_as_whole: 2.9, course_content: 3.0, instructor_contribution: 3.0, instructor_effectiveness: 2.6 },
    ai_summary: null,
  },
  {
    course_code: "CSS 343", section: "B", quarter: "Spring", year: 2025,
    responses: 9, enrollment: 26, overall_summative: 3.8, cei: 5.2,
    summative_items: { course_as_whole: 3.6, course_content: 3.8, instructor_contribution: 3.9, instructor_effectiveness: 3.9 },
    ai_summary: null,
  },
  {
    course_code: "CSS 385", section: "A", quarter: "Spring", year: 2025,
    responses: 10, enrollment: 46, overall_summative: 4.2, cei: 5.2,
    summative_items: { course_as_whole: 4.7, course_content: 4.2, instructor_contribution: 3.8, instructor_effectiveness: 3.8 },
    ai_summary: null,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📂 Loading seed.json...\n");

  const seedPath = path.resolve(process.cwd(), "seed.json");
  if (!fs.existsSync(seedPath)) {
    console.error("❌ seed.json not found in project root. Place it there and re-run.");
    process.exit(1);
  }

  const raw = fs.readFileSync(seedPath, "utf-8");
  const { professors: catalogProfessors }: SeedJson = JSON.parse(raw);

  console.log(`📊 Found ${catalogProfessors.length} professors in seed.json\n`);
  console.log("🌱 Writing professors to Firestore...\n");

  // Firestore batch limit is 500 ops — chunk into batches of 400 to be safe
  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < catalogProfessors.length; i += BATCH_SIZE) {
    const chunk = catalogProfessors.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const p of chunk) {
      const isPisan = p.id === "pisan_yusuf" || p.name === "Yusuf Pisan";

      const profDoc = {
        name: p.name,
        department: p.department,
        campus: [p.campus],               // normalize to string[]
        email: p.email ?? "",
        bio: "",
        courses_taught: coursesTaught(p.courses),
        iasystem_ratings: isPisan ? PISAN_IASYSTEM : [],
        overall_rating: 0,
        ratings_count: 0,
        tags: [],
        summary: null,
        summary_updated_at: null,
        summary_review_count: 0,
      };

      batch.set(db.collection("professors").doc(p.id), profDoc);
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  ✅ ${written} / ${catalogProfessors.length} professors written`);
  }

  console.log("\n📝 Writing Yusuf Pisan stub reviews...\n");

  // Find Pisan's doc ID in the catalog
  const pisanEntry = catalogProfessors.find((p) => p.name === "Yusuf Pisan");
  const pisanId = pisanEntry?.id ?? "pisan_yusuf";

  let pisanSum = 0;
  let pisanCount = 0;

  for (const review of PISAN_REVIEWS) {
    const { course_code, campus, quarter, year, author_netid, ...rest } = review;
    const campusSlug = campus.replace(/\s+/g, "");
    const docId = `${author_netid}_${pisanId}_${course_code.replace(/\s/g, "")}_${campusSlug}_${quarter}${year}`;

    await db.collection("reviews").doc(docId).set({
      id: docId,
      professor_id: pisanId,
      author_id: author_netid,
      verified: review.verified,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: "published",
      flagged: false,
      campus,
      course: { code: course_code, name: "" },
      term: { quarter, year },
      scores: rest.scores,
      body: rest.body,
      tags: rest.tags,
      grade_received: null,
      attendance_mandatory: null,
      textbook_required: null,
      votes: { helpful: 0, not_helpful: 0 },
    });

    pisanSum += review.scores.overall;
    pisanCount++;

    const badge = review.verified ? "✅ verified  " : "⚠️  unverified";
    console.log(`  ${badge} — ${pisanId} · ${course_code} (${review.scores.overall}★)`);
  }

  // Update Pisan's aggregate
  const pisanAvg = Math.round((pisanSum / pisanCount) * 10) / 10;
  await db.collection("professors").doc(pisanId).update({
    overall_rating: pisanAvg,
    ratings_count: pisanCount,
  });

  console.log(`\n📊 Pisan aggregate: ${pisanAvg} avg over ${pisanCount} reviews`);
  console.log("\n✨ Import complete.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
