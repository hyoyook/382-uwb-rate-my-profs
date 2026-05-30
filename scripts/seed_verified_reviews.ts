/**
 * scripts/seed_verified_reviews.ts
 * Seeds 30+ verified reviews across 15 UW Bothell CSS professors.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/seed_verified_reviews.ts
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

const SEED_USERS = [
  { uid: "kCfLDmUjPKSZ27gIbKByeZJ8PNm1", netid: "seeduser1" },
  { uid: "I7EFPs2jHNNL1CO14Ir39OhdXXA3", netid: "seeduser2" },
  { uid: "WvtVbL5kuUZmiQJg3ZeVwuMmZHm2", netid: "seeduser3" },
];

type ReviewSeed = {
  professor_id: string;
  course_code: string;
  campus: string;
  quarter: string;
  year: number;
  user_index: number;
  scores: { overall: number; clarity: number; helpfulness: number; difficulty: number; would_take_again: boolean };
  body: string;
  tags: string[];
  grade_received: string | null;
  attendance_mandatory: boolean | null;
  textbook_required: boolean | null;
};

const REVIEWS: ReviewSeed[] = [
  // ── Yusuf Pisan (3) ───────────────────────────────────────────────────────
  {
    professor_id: "pisan_yusuf", course_code: "CSS 343", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "Pisan is one of the best professors in the CSS department. His LeetCode sessions make abstract data structures genuinely click, and the projects are directly relevant to technical interviews. Attend every lecture — you will not regret it.",
    tags: ["amazing lectures", "interview-prep", "project-based"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "pisan_yusuf", course_code: "CSS 430", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 5, would_take_again: true },
    body: "CSS 430 is one of the hardest classes in the program but Pisan makes the workload manageable. OS concepts are explained clearly and the programming projects reinforce lecture material well. Start assignments early — they take way longer than expected.",
    tags: ["lots of homework", "clear grading criteria", "tough grader"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "pisan_yusuf", course_code: "CSS 343", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "Great professor for data structures. In-class coding sessions are genuinely useful and he is very accessible during office hours. If you attend lectures and practice the LeetCode problems he assigns you will do well on exams.",
    tags: ["accessible outside class", "engaging lecturer", "test heavy"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },

  // ── Marc Dupuis (3) ───────────────────────────────────────────────────────
  {
    professor_id: "dupuis_marc", course_code: "CSS 310", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 1,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "One of the most engaging professors I have had. Professor Dupuis brings real-world cybersecurity examples into every lecture which makes the material feel relevant. Super approachable outside of class and responds to emails quickly.",
    tags: ["amazing lectures", "caring", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "dupuis_marc", course_code: "CSS 517", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Dupuis clearly cares about student success. His lectures are well-structured and he ties cybersecurity theory to practical applications throughout the course. Assignments are challenging but very educational. Would take him again.",
    tags: ["clear grading criteria", "gives good feedback", "caring"],
    grade_received: "A+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "dupuis_marc", course_code: "CSS 310", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 2, would_take_again: true },
    body: "Good professor overall. Lectures cover the material clearly and exams are fair if you attend class regularly. He goes a bit fast on some advanced topics but for an intro cybersecurity course this is an excellent choice.",
    tags: ["clear grading criteria", "respected"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ── Hazeline Asuncion (2) ─────────────────────────────────────────────────
  {
    professor_id: "asuncion_hazeline", course_code: "CSS 360", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Professor Asuncion is one of the best in the department. Software engineering concepts are presented clearly and the group project gives real experience with the full development lifecycle. She is very supportive and gives detailed feedback on every deliverable.",
    tags: ["amazing lectures", "gives good feedback", "group projects"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "asuncion_hazeline", course_code: "CSS 360", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Great software engineering course. The group project is the main focus and it is well-structured with clear milestones. Professor Asuncion is approachable and genuinely invested in each team's success. Would recommend to any CSS student.",
    tags: ["group projects", "caring", "clear grading criteria"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: false,
  },

  // ── Brent Lagesse (2) ─────────────────────────────────────────────────────
  {
    professor_id: "lagesse_brent_j", course_code: "CSS 432", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Lagesse is very knowledgeable about networking and security. He teaches at a fast pace so keeping up with readings is essential. Projects are very practical — you genuinely learn how networks work. Office hours are helpful when you arrive with specific questions.",
    tags: ["lecture heavy", "knowledgeable", "accessible outside class"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "lagesse_brent_j", course_code: "CSS 432", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 2,
    scores: { overall: 5, clarity: 4, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "One of the most interesting courses in the CSS program. Professor Lagesse brings genuine research expertise into the classroom and the content on adversarial ML is unlike anything else offered here. Very helpful during office hours.",
    tags: ["inspirational", "accessible outside class", "lots of homework"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ── Clark Olson (2) ───────────────────────────────────────────────────────
  {
    professor_id: "olson_clark", course_code: "CSS 487", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Professor Olson is a solid lecturer with deep expertise in computer vision. The course covers image processing, feature detection, and ML applications. Assignments are well-designed and the final project lets you explore a topic you are genuinely interested in.",
    tags: ["clear grading criteria", "project-based", "knowledgeable"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "olson_clark", course_code: "CSS 487", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 2,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 3, would_take_again: true },
    body: "The material is interesting but lectures can be dense without prior background in linear algebra. Would recommend reviewing matrix math before enrolling. Professor Olson is available during office hours and willing to help when you come with specific questions.",
    tags: ["get ready to read", "lecture heavy"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ── Dong Si (2) ───────────────────────────────────────────────────────────
  {
    professor_id: "si_dong", course_code: "CSS 490", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Si's capstone course is one of the most rewarding experiences in the CSS program. He provides clear guidance throughout the project lifecycle and is always available for feedback. His background in AI and computational biology brings a unique perspective.",
    tags: ["gives good feedback", "caring", "inspirational"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "si_dong", course_code: "CSS 475", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Great databases and data science course. Professor Si explains complex concepts clearly and assignments build on each other well. He is responsive on email and genuinely wants students to succeed. A bit heavy on theory at times but assignments balance it out.",
    tags: ["clear grading criteria", "gives good feedback", "accessible outside class"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },

  // ── Michael Stiber (2) ────────────────────────────────────────────────────
  {
    professor_id: "stiber_michael", course_code: "CSS 458", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Computer simulation is a niche but fascinating course and Professor Stiber knows the material deeply. Projects involve building real simulations in Python which is a great learning experience. The course requires strong programming fundamentals so be prepared.",
    tags: ["project-based", "knowledgeable", "lots of homework"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "stiber_michael", course_code: "CSS 458", campus: "UW Bothell",
    quarter: "Spring", year: 2024, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "One of the most unique courses at UWB. Stiber is clearly passionate about computational neuroscience and simulation and that enthusiasm is contagious. This course stretched my thinking in ways other CS classes did not. Highly recommend for anyone interested in AI or scientific computing.",
    tags: ["inspirational", "amazing lectures", "project-based"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ── Kelvin Sung (2) ───────────────────────────────────────────────────────
  {
    professor_id: "sung_kelvin", course_code: "CSS 451", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 3, helpfulness: 4, difficulty: 5, would_take_again: true },
    body: "CSS 451 is brutal — expect to spend 20+ hours a week on assignments. But if you love computer graphics and are willing to put in the work, you will learn more here than in almost any other class. Sung is demanding but fair and his feedback is always detailed.",
    tags: ["tough grader", "gives good feedback", "lots of homework"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "sung_kelvin", course_code: "CSS 490", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Sung's capstone section is excellent. He pushes students to build something they are genuinely proud of and his industry experience shows in how he frames project scope and delivery. Very different from his graphics courses — more collaborative and encouraging.",
    tags: ["inspirational", "gives good feedback", "group projects"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ── Johnny Lin (2) ────────────────────────────────────────────────────────
  {
    professor_id: "lin_johnny", course_code: "CSS 112", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Professor Lin is an exceptional teacher for intro programming. He breaks down concepts in a way that makes sense even if you have never coded before. Very patient and willing to explain things multiple ways. The course is well-paced and assignments are genuinely interesting.",
    tags: ["amazing lectures", "caring", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "lin_johnny", course_code: "CSS 142", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 5, helpfulness: 4, difficulty: 2, would_take_again: true },
    body: "Really enjoyed this class. Professor Lin is clear, organized, and makes the material approachable. Programming assignments build on each other logically. A great starting point for anyone new to computer science at UWB.",
    tags: ["clear grading criteria", "online savvy", "extra credit"],
    grade_received: "A+", attendance_mandatory: false, textbook_required: false,
  },

  // ── Yang Peng (2) ─────────────────────────────────────────────────────────
  {
    professor_id: "peng_yang", course_code: "CSS 433", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Professor Peng teaches parallel computing with a lot of depth. The MPI and OpenMP assignments are challenging but very practical for anyone interested in high-performance computing. He is fair in grading and gives good partial credit when you show your reasoning.",
    tags: ["clear grading criteria", "lots of homework", "knowledgeable"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "peng_yang", course_code: "CSS 433", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 4, would_take_again: true },
    body: "The course material on IoT and sensor networks is very relevant to the industry but the lectures can be hard to follow at times. The assignments are well-designed though and you do learn a lot by working through them. Go to office hours if you are struggling.",
    tags: ["lecture heavy", "lots of homework"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ── Afra Mashhadi (2) ─────────────────────────────────────────────────────
  {
    professor_id: "mashhadi_afra", course_code: "CSS 484", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Mashhadi is fantastic. Her course on big data and crowd-sensing is genuinely cutting edge and she brings her own research directly into the classroom. The final project gave me something real to put on my resume. Highly recommend.",
    tags: ["inspirational", "project-based", "amazing lectures"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "mashhadi_afra", course_code: "CSS 484", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Really interesting course on ubiquitous computing and applied ML. Professor Mashhadi is passionate about the subject and that shows in how she teaches. Assignments involve real datasets which makes the work feel meaningful. Good choice for anyone interested in AI applications.",
    tags: ["gives good feedback", "online savvy", "project-based"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },

  // ── Munehiro Fukuda (2) ───────────────────────────────────────────────────
  {
    professor_id: "fukuda_munehiro", course_code: "CSS 534", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 5, would_take_again: true },
    body: "Professor Fukuda is one of the most knowledgeable professors in the department when it comes to parallel and distributed computing. The course is demanding but if you put in the work you will come out with skills that are genuinely rare among undergraduates.",
    tags: ["tough grader", "knowledgeable", "lots of homework"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "fukuda_munehiro", course_code: "CSS 534", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 2,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 5, would_take_again: false },
    body: "Very challenging course and the lecture slides are dense. Professor Fukuda knows his material deeply but expects a lot from students. The programming assignments on parallel simulation are interesting but the learning curve is steep. Come in with a strong background in systems.",
    tags: ["lecture heavy", "tough grader", "get ready to read"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ── Kaylea Champion (2) ───────────────────────────────────────────────────
  {
    professor_id: "champion_kaylea", course_code: "CSS 385", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Professor Champion is an outstanding teacher. Her course on human-computer interaction is engaging and practical. She encourages critical thinking about the societal impact of software which is something most CS courses overlook. Would take her again in any course.",
    tags: ["amazing lectures", "caring", "inspirational"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "champion_kaylea", course_code: "CSS 385", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Great professor who makes you think beyond just writing code. The assignments involve real user research and usability testing which is very different from most CSS courses. She is very supportive and gives genuinely useful feedback on your work.",
    tags: ["gives good feedback", "group projects", "participation matters"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: false,
  },

  // ── Wooyoung Kim (2) ─────────────────────────────────────────────────────
  {
    professor_id: "kim_wooyoung", course_code: "CSS 419", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Professor Kim's computational biology course is a fascinating intersection of CS and biology. The course assumes no biology background which is helpful. Assignments involve analyzing real genomic datasets which is a cool experience. He is patient and happy to explain biological concepts from scratch.",
    tags: ["knowledgeable", "clear grading criteria", "online savvy"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "kim_wooyoung", course_code: "CSS 419", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 1,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 3, would_take_again: true },
    body: "Interesting course but the lectures can be hard to follow if you do not have any biology background. The assignments are well-designed and the textbook is helpful. Professor Kim is approachable during office hours and willing to explain concepts at whatever level you need.",
    tags: ["get ready to read", "accessible outside class"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },

  // ── Geethapriya Thamilarasu (2) ───────────────────────────────────────────
  {
    professor_id: "thamilarasu_geethapriya", course_code: "CSS 422", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Thamilarasu is excellent. Her wireless security course covers content that is highly relevant given how much of computing runs on mobile and IoT devices. She explains complex protocols clearly and the hands-on labs make the material concrete. One of my favorite courses at UWB.",
    tags: ["amazing lectures", "accessible outside class", "clear grading criteria"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "thamilarasu_geethapriya", course_code: "CSS 422", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Solid professor with a lot of expertise in IoT security. Lectures are well-organized and the course moves at a reasonable pace. The research paper review assignments were more work than expected but very educational. She is responsive on email.",
    tags: ["clear grading criteria", "lots of homework", "respected"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📝 Seeding ${REVIEWS.length} verified reviews across 15 professors...\n`);

  const aggregates: Record<string, { sum: number; count: number }> = {};
  let written = 0;

  for (const r of REVIEWS) {
    const user = SEED_USERS[r.user_index];
    const campusSlug = r.campus.replace(/\s+/g, "");
    const courseSlug = r.course_code.replace(/\s+/g, "");
    const docId = `${user.netid}_${r.professor_id}_${courseSlug}_${campusSlug}_${r.quarter}${r.year}`;

    await db.collection("reviews").doc(docId).set({
      id: docId,
      professor_id: r.professor_id,
      author_id: user.uid,
      verified: true,
      status: "published",
      flagged: false,
      campus: r.campus,
      course: { code: r.course_code, name: "" },
      term: { quarter: r.quarter, year: r.year },
      scores: r.scores,
      body: r.body,
      tags: r.tags,
      grade_received: r.grade_received,
      attendance_mandatory: r.attendance_mandatory,
      textbook_required: r.textbook_required,
      votes: { helpful: 0, not_helpful: 0 },
      voter_ids: [],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: null,
    });

    if (!aggregates[r.professor_id]) aggregates[r.professor_id] = { sum: 0, count: 0 };
    aggregates[r.professor_id].sum += r.scores.overall;
    aggregates[r.professor_id].count += 1;

    console.log(`  ✅ ${docId} (${r.scores.overall}★)`);
    written++;
  }

  console.log("\n📊 Updating professor aggregates...\n");

  for (const [profId, { sum, count }] of Object.entries(aggregates)) {
    const ref = db.collection("professors").doc(profId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`  ⚠️  Not found, skipping: ${profId}`);
      continue;
    }

    const current = snap.data()!;
    const prevCount: number = current.ratings_count ?? 0;
    const prevAvg: number = current.overall_rating ?? 0;
    const newCount = prevCount + count;
    const newAvg = Math.round(((prevAvg * prevCount + sum) / newCount) * 10) / 10;

    await ref.update({ overall_rating: newAvg, ratings_count: newCount });
    console.log(`  ✅ ${profId}: ${newAvg} avg (${newCount} total reviews)`);
  }

  console.log(`\n✨ Done. ${written} verified reviews seeded.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
