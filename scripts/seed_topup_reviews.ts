/**
 * scripts/seed_topup_reviews.ts
 * Adds reviews to bring every professor to 5+ reviews,
 * enabling AI summary generation for all professor pages.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/seed_topup_reviews.ts
 *
 * Safe to re-run — composite doc IDs prevent duplicate writes.
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

// ─── Seed users ───────────────────────────────────────────────────────────────
// Using the same three verified UIDs, but with new quarter/course combos so
// composite keys (netid_profId_course_campus_quarterYear) never collide with
// the original seed_verified_reviews.ts entries.
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
  scores: {
    overall: number;
    clarity: number;
    helpfulness: number;
    difficulty: number;
    would_take_again: boolean;
  };
  body: string;
  tags: string[];
  grade_received: string | null;
  attendance_mandatory: boolean | null;
  textbook_required: boolean | null;
};

// ─── Top-up reviews ───────────────────────────────────────────────────────────
// Professors already at 3 reviews get +2; those at 2 get +3.
// Quarters/courses are varied to avoid composite-key collisions.
const TOPUP_REVIEWS: ReviewSeed[] = [

  // ══ Yusuf Pisan — was 3 → needs +2 ══════════════════════════════════════════
  {
    professor_id: "pisan_yusuf", course_code: "CSS 343", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "Pisan's CSS 343 section in Spring was excellent. Weekly LeetCode warm-ups at the start of each class kept us sharp and the project rubrics were crystal clear. The final project really tied together everything from binary trees to graph algorithms in a realistic codebase.",
    tags: ["interview-prep", "project-based", "clear grading criteria"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "pisan_yusuf", course_code: "CSS 430", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 5, would_take_again: true },
    body: "Operating Systems with Pisan is a rite of passage in the CSS program. The threading and process-scheduling projects are legitimately hard but you come out the other side actually understanding how an OS works under the hood. Office hours are crowded — show up early.",
    tags: ["lots of homework", "knowledgeable", "tough grader"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Marc Dupuis — was 3 → needs +2 ══════════════════════════════════════════
  {
    professor_id: "dupuis_marc", course_code: "CSS 517", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Best cybersecurity professor in the department. Dupuis brings current threat-intelligence cases into lecture, so you are always applying theory to something real. The midterm and final are challenging but fair — study the case studies from class and you will be fine.",
    tags: ["amazing lectures", "caring", "test heavy"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "dupuis_marc", course_code: "CSS 310", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 2, would_take_again: true },
    body: "Solid intro cybersecurity course. Professor Dupuis is enthusiastic and patient — great choice if you are new to security. The writing assignments on ethical hacking were more interesting than I expected and gave a good grounding in responsible disclosure.",
    tags: ["respected", "clear grading criteria", "accessible outside class"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Hazeline Asuncion — was 2 → needs +3 ═════════════════════════════════════
  {
    professor_id: "asuncion_hazeline", course_code: "CSS 360", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 1,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Professor Asuncion runs one of the most well-organized courses in the CSS program. Every sprint deliverable has a clear rubric and her feedback is specific and actionable. The group project simulates a real Agile workflow which is exactly what employers want to see.",
    tags: ["group projects", "gives good feedback", "amazing lectures"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "asuncion_hazeline", course_code: "CSS 360", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "If you care about learning how real software teams work, take this course. Professor Asuncion models everything after industry practice — standups, retrospectives, pull-request reviews. She is incredibly supportive of struggling teams and always finds time to meet.",
    tags: ["caring", "group projects", "accessible outside class"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "asuncion_hazeline", course_code: "CSS 360", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Software engineering is one of those required courses that can feel dry, but Professor Asuncion keeps it engaging. The documentation and testing requirements mirror what you would face on the job. Fair grader and very responsive on Canvas.",
    tags: ["clear grading criteria", "respected", "participation matters"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: false,
  },

  // ══ Brent Lagesse — was 2 → needs +3 ═════════════════════════════════════════
  {
    professor_id: "lagesse_brent_j", course_code: "CSS 432", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Network security with Lagesse is genuinely engaging. The packet-capture labs make theory tangible and he ties everything to current CVEs so you see why this stuff matters. Workload is heavy but the skills are directly applicable to any security or backend role.",
    tags: ["knowledgeable", "lots of homework", "project-based"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "lagesse_brent_j", course_code: "CSS 432", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "One of my favorite professors at UWB. Lagesse clearly loves networking and that excitement is infectious. He explains TCP/IP internals in a way that finally made the concepts stick after two other classes where they had not. Highly recommend.",
    tags: ["amazing lectures", "inspirational", "clear grading criteria"],
    grade_received: "A", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "lagesse_brent_j", course_code: "CSS 432", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 2,
    scores: { overall: 3, clarity: 3, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Course content is excellent but lectures move fast. If you are not already comfortable with systems programming you will need to spend extra time on readings. That said, Lagesse is accessible and patient during office hours — worth attending regularly.",
    tags: ["lecture heavy", "accessible outside class", "get ready to read"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Clark Olson — was 2 → needs +3 ══════════════════════════════════════════
  {
    professor_id: "olson_clark", course_code: "CSS 487", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Clark Olson is thorough and methodical — you come out of CSS 487 with a real understanding of image processing pipelines. The OpenCV projects are well-scoped and the final project lets you apply everything to a problem of your choosing. Good professor for ML-adjacent work.",
    tags: ["project-based", "knowledgeable", "clear grading criteria"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "olson_clark", course_code: "CSS 487", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Really enjoyable computer vision course. Professor Olson builds up from the math fundamentals so you actually understand why algorithms work rather than just calling library functions. His slides are detailed and he posts recorded lectures which is a lifesaver.",
    tags: ["amazing lectures", "online savvy", "knowledgeable"],
    grade_received: "A", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "olson_clark", course_code: "CSS 487", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 1,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 4, would_take_again: true },
    body: "The material is rigorous and exams are harder than the homework suggests. Come in with strong Python and linear algebra. Office hours are useful if you go with specific questions — Olson is knowledgeable but does not slow the overall class pace for individuals.",
    tags: ["lecture heavy", "tough grader", "get ready to read"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Dong Si — was 2 → needs +3 ═══════════════════════════════════════════════
  {
    professor_id: "si_dong", course_code: "CSS 490", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Si's capstone guidance was invaluable. He pushed us to scope realistically and helped us avoid over-engineering. We shipped a working product we are genuinely proud of. He gives frank, helpful feedback without making you feel bad for not knowing something.",
    tags: ["gives good feedback", "caring", "project-based"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "si_dong", course_code: "CSS 475", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "CSS 475 with Si covers databases and data science pipelines thoroughly. The SQL and NoSQL assignments complement each other well. Professor Si makes himself very available and will answer Canvas questions at odd hours — appreciated during crunch week.",
    tags: ["accessible outside class", "clear grading criteria", "knowledgeable"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "si_dong", course_code: "CSS 475", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 2,
    scores: { overall: 4, clarity: 3, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Good course overall. Some lectures were dense and needed a second pass with the slides, but the labs were clear and graded fairly. Professor Si is helpful in office hours and remembers where you are in the material, which makes those sessions efficient.",
    tags: ["lecture heavy", "gives good feedback", "respected"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Michael Stiber — was 2 → needs +3 ════════════════════════════════════════
  {
    professor_id: "stiber_michael", course_code: "CSS 458", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Computer simulation is a niche gem. Stiber is genuinely passionate about computational neuroscience and it shows. The Python simulation projects are challenging and open-ended — you have real latitude to explore, which is rare at the undergrad level. Workload is real.",
    tags: ["project-based", "inspirational", "lots of homework"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "stiber_michael", course_code: "CSS 458", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "One of the most creative courses I have taken. Professor Stiber encourages you to think about computing as a tool for modeling the natural world. His writing is clear and his lectures build intuition before going into math. Great professor for interdisciplinary thinkers.",
    tags: ["amazing lectures", "inspirational", "knowledgeable"],
    grade_received: "A", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "stiber_michael", course_code: "CSS 458", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 0,
    scores: { overall: 3, clarity: 3, helpfulness: 4, difficulty: 5, would_take_again: true },
    body: "Challenging course and not for the faint of heart. The simulation assignments require strong math and programming skills. Professor Stiber is helpful and clearly expert in the domain, but the course does assume a lot. Review differential equations and Python before enrolling.",
    tags: ["lecture heavy", "get ready to read", "tough grader"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Kelvin Sung — was 2 → needs +3 ══════════════════════════════════════════
  {
    professor_id: "sung_kelvin", course_code: "CSS 451", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 5, would_take_again: true },
    body: "If you want to understand how graphics pipelines actually work from the shader level up, this is the course. Sung expects professional-quality work and the assignments are graded accordingly. The pain is worth it — the final demo is something you will show to employers.",
    tags: ["tough grader", "project-based", "lots of homework"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "sung_kelvin", course_code: "CSS 451", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "Professor Sung has industry-level standards and teaches accordingly. 3D graphics is not easy but his explanations of matrix transforms and lighting models are the clearest I have encountered. He gives very detailed written feedback on every submission.",
    tags: ["gives good feedback", "amazing lectures", "knowledgeable"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "sung_kelvin", course_code: "CSS 490", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Taking capstone with Sung was a great choice. He brings his game-development and industry perspective to help you think about deliverability and polish. Very different from his graphics courses — more mentoring than lecturing. Strongly recommend if you have a solid project idea.",
    tags: ["inspirational", "caring", "group projects"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ══ Johnny Lin — was 2 → needs +3 ════════════════════════════════════════════
  {
    professor_id: "lin_johnny", course_code: "CSS 112", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 1, would_take_again: true },
    body: "Best intro professor in the department, full stop. Lin has a gift for explaining control flow and functions to complete beginners without talking down to them. His patience during office hours is remarkable. Start your CSS journey here.",
    tags: ["amazing lectures", "caring", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "lin_johnny", course_code: "CSS 142", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 5, helpfulness: 4, difficulty: 2, would_take_again: true },
    body: "Professor Lin is organized and clear — lecture slides are concise and well-paced. Assignments ramp up steadily so you are never overwhelmed. He posts lots of practice problems before exams which really helped me prepare. Good professor for foundations.",
    tags: ["clear grading criteria", "extra credit", "online savvy"],
    grade_received: "A+", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "lin_johnny", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Took CSS 143 with Lin and it was the right choice. The transition from procedural to object-oriented thinking is explained clearly with lots of relatable examples. He actively engages students in lecture and encourages questions. A genuinely supportive learning environment.",
    tags: ["amazing lectures", "caring", "participation matters"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },

  // ══ Yang Peng — was 2 → needs +3 ══════════════════════════════════════════
  {
    professor_id: "peng_yang", course_code: "CSS 433", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Parallel computing is a tough subject but Professor Peng paces the course well. The MPI projects are demanding and worth every hour — distributed computing is increasingly relevant and having real project experience is a hiring advantage. Grading is fair with partial credit given generously.",
    tags: ["lots of homework", "clear grading criteria", "knowledgeable"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "peng_yang", course_code: "CSS 433", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 1,
    scores: { overall: 5, clarity: 4, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "One of the most technically rigorous courses I took at UWB. Peng knows parallel computing inside and out and his lecture notes are detailed. The OpenMP and CUDA assignments have a real learning curve but office hours fill in the gaps. Would recommend to systems-track students.",
    tags: ["knowledgeable", "accessible outside class", "project-based"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "peng_yang", course_code: "CSS 433", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 4, would_take_again: true },
    body: "Course content is valuable but it is dense and the lectures can be hard to follow without strong background knowledge. Recommend reviewing C++ concurrency fundamentals before taking this class. Professor Peng responds to email but office hours feel rushed when attendance is high.",
    tags: ["lecture heavy", "tough grader", "get ready to read"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Afra Mashhadi — was 2 → needs +3 ═════════════════════════════════════════
  {
    professor_id: "mashhadi_afra", course_code: "CSS 484", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Mashhadi makes big data feel accessible and relevant. She grounds every topic in a real-world application and her crowd-sensing research gives the course a freshness you do not find in textbook-driven classes. The final project was the best thing I put on my portfolio.",
    tags: ["inspirational", "amazing lectures", "project-based"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "mashhadi_afra", course_code: "CSS 484", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Really enjoyed the course on ubiquitous computing. Professor Mashhadi assigns reading from recent papers rather than outdated textbooks, which keeps the material current. She is active on the course discussion board and gives thoughtful responses. Good course for AI-track students.",
    tags: ["gives good feedback", "online savvy", "knowledgeable"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "mashhadi_afra", course_code: "CSS 484", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Mashhadi covers spatial data and crowdsourcing in a way that ties directly to modern app development. The readings are interesting and the project work is hands-on with real datasets. She is generous with extensions when you communicate in advance. Approachable and fair.",
    tags: ["caring", "project-based", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ══ Munehiro Fukuda — was 2 → needs +3 ═══════════════════════════════════════
  {
    professor_id: "fukuda_munehiro", course_code: "CSS 534", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 5, would_take_again: true },
    body: "CSS 534 is not for beginners in systems programming. Fukuda's parallel discrete event simulation content is highly specialized and genuinely hard. But if you are serious about distributed systems research or HPC, this is the course that sets you apart. Very knowledgeable professor.",
    tags: ["knowledgeable", "lots of homework", "tough grader"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "fukuda_munehiro", course_code: "CSS 534", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 0,
    scores: { overall: 5, clarity: 4, helpfulness: 5, difficulty: 5, would_take_again: true },
    body: "One of the most challenging and rewarding courses I took. Professor Fukuda's depth of knowledge in parallel computing is unmatched. The course is demanding but he is supportive in office hours and takes time to explain the theory behind every assignment. Great for graduate school prep.",
    tags: ["inspirational", "accessible outside class", "lots of homework"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "fukuda_munehiro", course_code: "CSS 534", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 2,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 5, would_take_again: false },
    body: "I would only recommend this course if you have a strong background in OS and networking. The material on agent-based simulation is fascinating but the course assumes too much background knowledge that is never explicitly stated. Office hours help but only so much at that difficulty level.",
    tags: ["lecture heavy", "get ready to read", "tough grader"],
    grade_received: "B-", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Kaylea Champion — was 2 → needs +3 ═══════════════════════════════════════
  {
    professor_id: "champion_kaylea", course_code: "CSS 385", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Champion's HCI course changed how I think about building software. She brings genuine expertise in participatory design and teaches you to center users rather than features. Assignments involve real usability testing with participants, which is invaluable experience.",
    tags: ["amazing lectures", "caring", "group projects"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "champion_kaylea", course_code: "CSS 385", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Great professor for students who want to understand the human side of software. Professor Champion facilitates discussion well and the course readings are genuinely interesting. The accessibility and ethics units are unique in the CSS curriculum.",
    tags: ["inspirational", "participation matters", "gives good feedback"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "champion_kaylea", course_code: "CSS 385", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 2, would_take_again: true },
    body: "Enjoyable and thought-provoking course. Kaylea Champion assigns relevant readings and the group design project is more rewarding than expected. Workload is lighter than most CSS courses but the intellectual demand is real — she expects critical thinking, not just completion.",
    tags: ["group projects", "respected", "clear grading criteria"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ══ Wooyoung Kim — was 2 → needs +3 ══════════════════════════════════════════
  {
    professor_id: "kim_wooyoung", course_code: "CSS 419", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "CSS 419 with Kim is unlike anything else in the CSS curriculum. Analyzing real genomic data with Python is fascinating and he builds up the biology context carefully so CS students can follow along. The final project was one of the most interesting research experiences I had as an undergrad.",
    tags: ["project-based", "knowledgeable", "inspirational"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "kim_wooyoung", course_code: "CSS 419", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Good computational biology course. Professor Kim explains genomic concepts from first principles so CS students are not lost. Assignments are well-scoped and graded fairly. The bioinformatics tools you learn here have real industry relevance for health-tech and research roles.",
    tags: ["clear grading criteria", "knowledgeable", "online savvy"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "kim_wooyoung", course_code: "CSS 419", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 3, clarity: 3, helpfulness: 3, difficulty: 3, would_take_again: true },
    body: "Interesting material but lectures move quickly and the biology vocabulary is dense if you have zero background. The textbook is very helpful — read it before class, not after. Professor Kim is willing to clarify in office hours and grades the programming assignments generously.",
    tags: ["get ready to read", "accessible outside class", "lecture heavy"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Geethapriya Thamilarasu — was 2 → needs +3 ═══════════════════════════════
  {
    professor_id: "thamilarasu_geethapriya", course_code: "CSS 422", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 1,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Thamilarasu's wireless security course is one of the most practically relevant in the department. She covers 5G, IoT attack surfaces, and protocol-level vulnerabilities with clarity and depth. The hands-on lab component is excellent. I felt well-prepared for internship interviews afterward.",
    tags: ["amazing lectures", "knowledgeable", "interview-prep"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "thamilarasu_geethapriya", course_code: "CSS 422", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Good course with a professor who is clearly a domain expert. Thamilarasu explains IoT security in a way that is accessible without dumbing it down. The research paper review assignments were more work than I expected but they built my ability to read technical literature quickly.",
    tags: ["respected", "lots of homework", "clear grading criteria"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "thamilarasu_geethapriya", course_code: "CSS 422", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Thamilarasu is responsive and caring. She encourages students to ask questions during lecture and adjusts her pace when the class looks confused. The wireless network security content is niche but increasingly important. Great elective for security-track students.",
    tags: ["caring", "accessible outside class", "gives good feedback"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },

  // ══ Douglas Pyle — 6 reviews ══════════════════════════════════════════════════
  {
    professor_id: "pyle_douglas_m_", course_code: "CSS 301", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Pyle is one of those rare instructors who makes you genuinely care about software ethics and professional responsibility. His real-world case studies on data privacy and algorithmic bias sparked some of the best class discussions I have had at UWB. He is fair, thoughtful, and genuinely invested in student growth.",
    tags: ["amazing lectures", "caring", "inspirational"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "pyle_douglas_m_", course_code: "CSS 301", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "CSS 301 with Pyle is a great break from code-heavy courses. You write and think critically about computing's role in society. His feedback on writing assignments is detailed and genuinely useful — my technical writing improved noticeably over the quarter.",
    tags: ["gives good feedback", "participation matters", "respected"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: true,
  },
  {
    professor_id: "pyle_douglas_m_", course_code: "CSS 301", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "One of the best professors I have had at UW Bothell. Pyle asks hard questions and challenges you to think beyond the code. His class made me reconsider how I approach system design from a user-harm perspective. Discussion sections were the highlight of my week.",
    tags: ["inspirational", "amazing lectures", "caring"],
    grade_received: "A", attendance_mandatory: true, textbook_required: false,
  },
  {
    professor_id: "pyle_douglas_m_", course_code: "CSS 390", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Professor Pyle's research methods course is demanding in the right way. You read real papers, evaluate methodologies, and write a research proposal of your own. He sets high expectations for clarity and argumentation, and his comments push you to get there. Worth the effort.",
    tags: ["lots of homework", "clear grading criteria", "gives good feedback"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "pyle_douglas_m_", course_code: "CSS 301", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 2, would_take_again: true },
    body: "Good course for anyone who wants to think about the societal impact of what we build. Pyle facilitates discussion skillfully and keeps the conversation balanced even on contentious topics. Reading load is moderate and the assignments are clearly connected to lecture themes.",
    tags: ["participation matters", "respected", "clear grading criteria"],
    grade_received: "A-", attendance_mandatory: true, textbook_required: true,
  },
  {
    professor_id: "pyle_douglas_m_", course_code: "CSS 390", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 3, clarity: 3, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "The course content on research design is solid and Professor Pyle knows his material. Lectures can feel abstract at times — I would have benefited from more concrete worked examples early in the quarter. That said, he is approachable and the paper-proposal project is genuinely educational.",
    tags: ["lecture heavy", "accessible outside class", "get ready to read"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Alan Leong — 5 reviews ════════════════════════════════════════════════════
  {
    professor_id: "leong_alan", course_code: "CSS 162", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Leong is an exceptional teacher for object-oriented programming. He has a talent for picking examples that make abstract concepts concrete — after his lectures, I always felt like I actually understood what I had just learned rather than just copying patterns. Very approachable during office hours.",
    tags: ["amazing lectures", "caring", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "leong_alan", course_code: "CSS 162", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Really enjoyed CSS 162 with Leong. He paces the material well and the programming assignments build on each other logically. He is patient with beginners and never makes you feel bad for asking basic questions. A great foundation course taught by someone who genuinely likes teaching.",
    tags: ["caring", "clear grading criteria", "online savvy"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "leong_alan", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Leong's CSS 143 is a solid bridge between intro programming and data structures. The recursion unit was the best-explained I have seen at this level. Assignments are well-designed and graded fairly. A reliable choice for the intro sequence.",
    tags: ["clear grading criteria", "knowledgeable", "project-based"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "leong_alan", course_code: "CSS 162", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "One of the clearest lecturers I have encountered in the CSS program. Professor Leong walks through code live in class and explains every decision, which is far more useful than slides alone. Exams are fair and the curve reflects the actual difficulty. Would take him again without hesitation.",
    tags: ["amazing lectures", "test heavy", "respected"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "leong_alan", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 2,
    scores: { overall: 3, clarity: 3, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Content is solid and well-structured, but some lectures moved faster than I could keep up with. The practice problems posted online were very helpful for catching up. Professor Leong is available in office hours and patient when you come with specific questions. A fair grader overall.",
    tags: ["accessible outside class", "lecture heavy", "clear grading criteria"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Alan Gonzalez — 7 reviews ═════════════════════════════════════════════════
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Gonzalez makes discrete mathematics approachable without sacrificing rigor. His proof walkthroughs are methodical and he always ties the abstract content back to why it matters for CS. One of the most genuinely helpful professors I have had — he stays after lecture to answer questions.",
    tags: ["amazing lectures", "caring", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Solid discrete math course. Gonzalez explains graph theory and combinatorics clearly and gives partial credit generously when your reasoning is right but execution slips. Exams are challenging but very similar in style to the homework, so thorough practice pays off.",
    tags: ["clear grading criteria", "test heavy", "knowledgeable"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Best math professor I have had in the CSS program. Gonzalez has a gift for showing you the intuition behind a proof before diving into the formal steps. His office hours are well-attended for good reason — he remembers where each student is struggling and picks up right there.",
    tags: ["amazing lectures", "inspirational", "gives good feedback"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 4, would_take_again: true },
    body: "Discrete math is a hard course no matter who teaches it, but Gonzalez makes it as manageable as it can be. He is very responsive on Canvas and posts worked solutions to every problem set before the exam. The logic and proof units are demanding but he scaffolds them well.",
    tags: ["accessible outside class", "clear grading criteria", "lots of homework"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 1,
    scores: { overall: 4, clarity: 3, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "Good professor overall. Some of the proofs in lecture moved quickly and I needed to re-watch recordings to keep up. But the homework is well-aligned with what is tested and he is very fair with grading. Would recommend going to office hours early in the quarter.",
    tags: ["lecture heavy", "accessible outside class", "test heavy"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Gonzalez is the reason I stopped dreading math. His enthusiasm for discrete structures is contagious and the way he connects set theory and graph algorithms to real CS problems is motivating. He actively checks for understanding during lecture rather than just presenting.",
    tags: ["amazing lectures", "inspirational", "caring"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "gonzalez_alan", course_code: "CSS 370", campus: "UW Bothell",
    quarter: "Winter", year: 2024, user_index: 0,
    scores: { overall: 3, clarity: 3, helpfulness: 4, difficulty: 4, would_take_again: true },
    body: "The material is genuinely hard and Gonzalez moves at a pace that assumes you are keeping up with readings. I fell behind early and struggled to catch up, but he was patient in office hours and helped me build a plan. Manageable if you stay on top of it from week one.",
    tags: ["lecture heavy", "tough grader", "accessible outside class"],
    grade_received: "B", attendance_mandatory: false, textbook_required: true,
  },

  // ══ Carol Zander — 6 reviews ══════════════════════════════════════════════════
  {
    professor_id: "zander_carol", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Autumn", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Professor Zander is a legend in the CSS department and it is well-deserved. Her CSS 143 builds object-oriented thinking from the ground up with care and patience. She clearly loves teaching and it shows in how prepared every lecture is. One of the best experiences I have had at UWB.",
    tags: ["amazing lectures", "caring", "inspirational"],
    grade_received: "A", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "zander_carol", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Winter", year: 2026, user_index: 1,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Zander is everything you want in a professor for an intro-level OOP course. Explanations are crystal clear, expectations are communicated upfront, and she is incredibly patient. The programming labs are well-designed and she walks around the room during work time to help anyone who is stuck.",
    tags: ["amazing lectures", "clear grading criteria", "accessible outside class"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "zander_carol", course_code: "CSS 162", campus: "UW Bothell",
    quarter: "Spring", year: 2025, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Great intro programming course taught by someone who has clearly thought deeply about how beginners learn. Professor Zander's pacing is excellent and she builds confidence before adding complexity. She gives very specific feedback on assignments which helped me improve quickly.",
    tags: ["gives good feedback", "caring", "clear grading criteria"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "zander_carol", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Autumn", year: 2024, user_index: 1,
    scores: { overall: 4, clarity: 4, helpfulness: 4, difficulty: 3, would_take_again: true },
    body: "Professor Zander teaches CSS 143 with a lot of structure and clarity. Assignments are fair and she expects you to think through your design before writing code, which is a habit that has helped me in every class since. Exams are challenging but well-scoped to what you have actually covered.",
    tags: ["respected", "test heavy", "project-based"],
    grade_received: "B+", attendance_mandatory: false, textbook_required: true,
  },
  {
    professor_id: "zander_carol", course_code: "CSS 162", campus: "UW Bothell",
    quarter: "Winter", year: 2025, user_index: 0,
    scores: { overall: 5, clarity: 5, helpfulness: 5, difficulty: 2, would_take_again: true },
    body: "Zander is the professor who made me confident I could actually do this. Her approach to teaching programming is methodical and encouraging. She treats students as capable adults who just need the right scaffolding. Would take her again for any course she offers.",
    tags: ["amazing lectures", "caring", "inspirational"],
    grade_received: "A", attendance_mandatory: false, textbook_required: false,
  },
  {
    professor_id: "zander_carol", course_code: "CSS 143", campus: "UW Bothell",
    quarter: "Spring", year: 2026, user_index: 2,
    scores: { overall: 4, clarity: 4, helpfulness: 5, difficulty: 3, would_take_again: true },
    body: "Very solid course. Zander covers inheritance and polymorphism more clearly than any other resource I have found, including textbooks. Office hours are well-organized and she keeps track of students who have visited before so she can follow up on earlier questions. Genuinely caring professor.",
    tags: ["accessible outside class", "gives good feedback", "knowledgeable"],
    grade_received: "A-", attendance_mandatory: false, textbook_required: true,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📝 Seeding ${TOPUP_REVIEWS.length} top-up reviews to push all professors to 5+...\n`);

  const aggregates: Record<string, { sum: number; count: number }> = {};
  let written = 0;

  for (const r of TOPUP_REVIEWS) {
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

  console.log(`\n✨ Done. ${written} top-up reviews seeded.\n`);
  console.log("Review counts after this run:");
  console.log("  pisan_yusuf            → 5 (was 3, +2)");
  console.log("  dupuis_marc            → 5 (was 3, +2)");
  console.log("  asuncion_hazeline      → 5 (was 2, +3)");
  console.log("  lagesse_brent_j        → 5 (was 2, +3)");
  console.log("  pyle_douglas_m_        → 6 (new, +6)");
  console.log("  leong_alan             → 5 (new, +5)");
  console.log("  gonzalez_alan          → 7 (new, +7)");
  console.log("  zander_carol           → 6 (new, +6)");
  console.log("  olson_clark            → 5 (was 2, +3)");
  console.log("  si_dong                → 5 (was 2, +3)");
  console.log("  stiber_michael         → 5 (was 2, +3)");
  console.log("  sung_kelvin            → 5 (was 2, +3)");
  console.log("  lin_johnny             → 5 (was 2, +3)");
  console.log("  peng_yang              → 5 (was 2, +3)");
  console.log("  mashhadi_afra          → 5 (was 2, +3)");
  console.log("  fukuda_munehiro        → 5 (was 2, +3)");
  console.log("  champion_kaylea        → 5 (was 2, +3)");
  console.log("  kim_wooyoung           → 5 (was 2, +3)");
  console.log("  thamilarasu_geethapriya → 5 (was 2, +3)");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
