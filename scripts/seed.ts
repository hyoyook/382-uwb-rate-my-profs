/**
 * scripts/seed.ts
 * Populates Firestore with stub UW professors and reviews.
 *
 * Run with:
 *   npx ts-node --project tsconfig.seed.json scripts/seed.ts
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * and FIREBASE_ADMIN_PRIVATE_KEY in your .env.local (loaded via dotenv).
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

// ─── Types ────────────────────────────────────────────────────────────────────

type IAsystemRatings = {
  overall_effectiveness: number;
  explains_clearly: number;
  available_for_help: number;
  stimulates_interest: number;
  assignments_valuable: number;
};

type Professor = {
  id: string;
  name: string;
  department: string;
  campus: string[];           // Option A: array supports multi-campus professors
  email: string;
  bio: string;
  photo_url: string | null;
  courses_taught: string[];
  iasystem_ratings: IAsystemRatings;
  overall_rating: number;
  ratings_count: number;
  tags: string[];
  summary: string | null;
  summary_updated_at: null;
};

type ReviewStub = {
  professor_id: string;
  course_code: string;
  campus: string;             // which campus this specific course was taught at
  quarter: string;
  year: number;
  rating: number;
  difficulty: number;
  would_take_again: boolean;
  body: string;
  tags: string[];
  author_netid: string;
  verified: boolean;          // true = UW peer review or IASystem; false = external (RMP)
  moderation_passed: boolean;
};

// ─── Professors ───────────────────────────────────────────────────────────────

const PROFESSORS: Professor[] = [
  // Real professor with IASystem data (CSS 343 D, Winter 2026)
  {
    id: "pisan-yusuf",
    name: "Yusuf Pisan",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "pisan@uwb.edu",
    bio: "Teaches data structures, algorithms, operating systems, and game development. Known for LeetCode-driven instruction and rigorous exams.",
    photo_url: null,
    courses_taught: ["CSS 142", "CSS 143", "CSS 342", "CSS 343", "CSS 385", "CSS 422", "CSS 430", "CSS 497"],
    // Real IASystem medians — CSS 343 D, Winter 2026
    iasystem_ratings: {
      overall_effectiveness: 4.3,   // "instructor's effectiveness in teaching"
      explains_clearly: 4.0,        // "explanations by instructor"
      available_for_help: 4.4,      // "availability of extra help when needed"
      stimulates_interest: 4.6,     // "instructor's enthusiasm"
      assignments_valuable: 4.7,    // "relevance and usefulness of course content"
    },
    overall_rating: 0,
    ratings_count: 0,
    tags: [],
    summary: null,
    summary_updated_at: null,
  },

  // Stub professors
  {
    id: "kim-sarah",
    name: "Sarah Kim",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "skim@uwb.edu",
    bio: "Specializes in distributed systems and cloud computing. Known for project-based courses.",
    photo_url: null,
    courses_taught: ["CSS 342", "CSS 385", "CSS 430", "CSS 487"],
    iasystem_ratings: { overall_effectiveness: 4.2, explains_clearly: 4.0, available_for_help: 4.5, stimulates_interest: 3.9, assignments_valuable: 4.3 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "nguyen-michael",
    name: "Michael Nguyen",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "mnguyen@uwb.edu",
    bio: "Focuses on algorithms, data structures, and competitive programming.",
    photo_url: null,
    courses_taught: ["CSS 143", "CSS 343", "CSS 501"],
    iasystem_ratings: { overall_effectiveness: 3.8, explains_clearly: 3.6, available_for_help: 4.1, stimulates_interest: 3.5, assignments_valuable: 4.0 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "patel-anita",
    name: "Anita Patel",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "apatel@uwb.edu",
    bio: "Machine learning and AI researcher. Teaches applied ML and data science courses.",
    photo_url: null,
    courses_taught: ["CSS 484", "CSS 581", "CSS 490"],
    iasystem_ratings: { overall_effectiveness: 4.6, explains_clearly: 4.5, available_for_help: 4.7, stimulates_interest: 4.8, assignments_valuable: 4.6 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "chen-david",
    name: "David Chen",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "dchen@uwb.edu",
    bio: "Software engineering and agile methodologies. Strong industry background.",
    photo_url: null,
    courses_taught: ["CSS 360", "CSS 370", "CSS 461"],
    iasystem_ratings: { overall_effectiveness: 4.0, explains_clearly: 3.8, available_for_help: 3.9, stimulates_interest: 4.1, assignments_valuable: 4.2 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "lee-jessica",
    name: "Jessica Lee",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell", "UW Seattle"],  // multi-campus example
    email: "jlee@uwb.edu",
    bio: "Human-computer interaction and UX research. Advocates for accessible design.",
    photo_url: null,
    courses_taught: ["CSS 301", "CSS 332", "CSS 475"],
    iasystem_ratings: { overall_effectiveness: 4.4, explains_clearly: 4.6, available_for_help: 4.3, stimulates_interest: 4.7, assignments_valuable: 4.5 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "rodriguez-carlos",
    name: "Carlos Rodriguez",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "crodriguez@uwb.edu",
    bio: "Systems programming and operating systems. Known for rigorous but fair grading.",
    photo_url: null,
    courses_taught: ["CSS 422", "CSS 430", "CSS 343"],
    iasystem_ratings: { overall_effectiveness: 3.6, explains_clearly: 3.4, available_for_help: 3.8, stimulates_interest: 3.5, assignments_valuable: 3.9 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "park-hyunjin",
    name: "Hyunjin Park",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "hpark@uwb.edu",
    bio: "Database systems and information retrieval. Passionate about query optimization.",
    photo_url: null,
    courses_taught: ["CSS 475", "CSS 480", "CSS 533"],
    iasystem_ratings: { overall_effectiveness: 4.3, explains_clearly: 4.4, available_for_help: 4.2, stimulates_interest: 4.1, assignments_valuable: 4.4 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
  {
    id: "wright-thomas",
    name: "Thomas Wright",
    department: "Computer Science & Software Engineering",
    campus: ["UW Bothell"],
    email: "twright@uwb.edu",
    bio: "Computer networks and security. Previously worked at Microsoft Azure.",
    photo_url: null,
    courses_taught: ["CSS 432", "CSS 486", "CSS 566"],
    iasystem_ratings: { overall_effectiveness: 4.1, explains_clearly: 4.0, available_for_help: 4.3, stimulates_interest: 4.2, assignments_valuable: 4.1 },
    overall_rating: 0, ratings_count: 0, tags: [], summary: null, summary_updated_at: null,
  },
];

// ─── Reviews ──────────────────────────────────────────────────────────────────
// verified: true  = UW-authenticated peer review OR IASystem official data
// verified: false = external unverified source (Rate My Professors)

const REVIEWS: ReviewStub[] = [

  // ── Yusuf Pisan — IASystem-sourced (verified: true) ────────────────────────
  // Spirit of open-ended comments from CSS 343 D, Winter 2026 IASystem report.
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2026,
    rating: 5,
    difficulty: 4,
    would_take_again: true,
    body: "The class was genuinely stimulating. LeetCode problems in lecture kept me engaged and the weekly projects built real understanding of data structures. The whiteboard explanations were especially helpful — when the slides were dense, Prof. Pisan could always clarify on the board.",
    tags: ["engaging-lecturer", "project-based", "interview-prep"],
    author_netid: "iasystem_wi26_01",
    verified: true,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2026,
    rating: 4,
    difficulty: 5,
    would_take_again: true,
    body: "Very hard class but directly relevant to software engineering. Topics like trees, heaps, and design patterns were tough to grasp at first — some required significant outside study. In-class exercises and practice exams helped a lot. Start projects early.",
    tags: ["tough-grader", "industry-relevant", "interview-prep"],
    author_netid: "iasystem_wi26_02",
    verified: true,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2026,
    rating: 4,
    difficulty: 4,
    would_take_again: true,
    body: "Pisan's enthusiasm for the material comes through clearly. The LeetCode approach is unique and practical for job interviews. Exams are difficult — study hard and attend every lecture since the whiteboard walkthroughs aren't replicated in the slides.",
    tags: ["engaging-lecturer", "tough-grader", "participation-matters"],
    author_netid: "iasystem_wi26_03",
    verified: true,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2026,
    rating: 3,
    difficulty: 5,
    would_take_again: true,
    body: "Some topics near the end (FSMs, Turing machines) lacked the clear follow-along explanations that made earlier topics click. More worked examples on those would help. The final project was harder but useful for understanding how to plan a large codebase.",
    tags: ["tough-grader", "knowledgeable"],
    author_netid: "iasystem_wi26_04",
    verified: true,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2026,
    rating: 5,
    difficulty: 4,
    would_take_again: true,
    body: "One of the best CS classes I've taken. The Huffman, autocomplete, and movies projects pushed my understanding further than any other class. LeetCode sessions in class are genuinely fun. Highly recommend attending every lecture.",
    tags: ["project-based", "engaging-lecturer", "interview-prep"],
    author_netid: "iasystem_wi26_05",
    verified: true,
    moderation_passed: true,
  },

  // ── Yusuf Pisan — RMP-sourced (verified: false) ────────────────────────────
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Spring",
    year: 2025,
    rating: 5,
    difficulty: 4,
    would_take_again: true,
    body: "Attend lectures — they're genuinely useful even if technically optional. He gives plenty of LeetCode practice so you understand material before applying it to assignments. Exams are difficult so study hard, but the class is worth it.",
    tags: ["participation-matters", "engaging-lecturer", "interview-prep"],
    author_netid: "rmp_stub_01",
    verified: false,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 342",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2024,
    rating: 3,
    difficulty: 4,
    would_take_again: true,
    body: "Lectures were fine and the LeetCode exercises after each topic helped reinforce the material. Midterm was reasonable but the final was noticeably harder. Graded by projects and exams only — no homework. Accessible outside class.",
    tags: ["test-heavy", "accessible-outside-class"],
    author_netid: "rmp_stub_02",
    verified: false,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2026,
    rating: 3,
    difficulty: 4,
    would_take_again: false,
    body: "Knowledgeable but high expectations. Exams are weighted heavily — about 60% of your grade — and the problems are medium-to-hard LeetCode difficulty. In-class exercises are graded on effort. Start homework early and be prepared to lock in.",
    tags: ["tough-grader", "test-heavy", "participation-matters"],
    author_netid: "rmp_stub_03",
    verified: false,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 430",
    campus: "UW Bothell",
    quarter: "Spring",
    year: 2026,
    rating: 3,
    difficulty: 4,
    would_take_again: true,
    body: "Respect for Pisan as a professor, but some of the course material felt AI-generated — large folders of practice questions that didn't clearly map to what would be on the test. Lectures were rushed covering 2-3 chapters per session.",
    tags: ["lecture-heavy", "test-heavy", "accessible-outside-class"],
    author_netid: "rmp_stub_04",
    verified: false,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Winter",
    year: 2021,
    rating: 5,
    difficulty: 4,
    would_take_again: true,
    body: "If you want an easy A with no effort, don't take him. If you want a solid understanding of data structures, algorithms, and C++, absolutely take him. He cares about students and will make complex topics accessible. Be ready to work hard.",
    tags: ["engaging-lecturer", "caring", "tough-grader"],
    author_netid: "rmp_stub_05",
    verified: false,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 342",
    campus: "UW Bothell",
    quarter: "Fall",
    year: 2020,
    rating: 5,
    difficulty: 4,
    would_take_again: true,
    body: "If you need help, talk to him — he listens and he genuinely cares. He's updated his curriculum based on student feedback and maintains a knowledge wiki. A professor who actually acts on feedback is rare.",
    tags: ["caring", "accessible-outside-class", "knowledgeable"],
    author_netid: "rmp_stub_06",
    verified: false,
    moderation_passed: true,
  },
  {
    professor_id: "pisan-yusuf",
    course_code: "CSS 343",
    campus: "UW Bothell",
    quarter: "Fall",
    year: 2023,
    rating: 5,
    difficulty: 3,
    would_take_again: true,
    body: "Course content was made much more digestible by Prof. Pisan. Still a hard class — especially without prior C++ experience — but he provides plenty of resources and if you focus in lectures and work outside class, you'll do well.",
    tags: ["knowledgeable", "project-based", "engaging-lecturer"],
    author_netid: "rmp_stub_07",
    verified: false,
    moderation_passed: true,
  },

  // ── Other stub professors (verified: true) ────────────────────────────────

  { professor_id: "kim-sarah", course_code: "CSS 342", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 5, difficulty: 3, would_take_again: true, body: "Professor Kim is fantastic. She breaks down distributed systems concepts clearly. The group project was challenging but I learned more from it than any other class. She holds detailed office hours and always responds to emails within a day.", tags: ["project-based", "engaging-lecturer", "helpful-office-hours"], author_netid: "stub_user_01", verified: true, moderation_passed: true },
  { professor_id: "kim-sarah", course_code: "CSS 342", campus: "UW Bothell", quarter: "Spring", year: 2024, rating: 4, difficulty: 4, would_take_again: true, body: "Workload is heavy but fair. Midterm was tough — make sure you understand the lecture slides. She cares about student learning and the content is genuinely useful for real engineering jobs.", tags: ["tough-grader", "industry-relevant"], author_netid: "stub_user_02", verified: true, moderation_passed: true },
  { professor_id: "kim-sarah", course_code: "CSS 430", campus: "UW Bothell", quarter: "Fall", year: 2023, rating: 4, difficulty: 4, would_take_again: true, body: "Solid professor. Lectures can be dense but she posts recordings which saved me multiple times. The cloud assignment using AWS was my favorite — very practical.", tags: ["project-based", "industry-relevant", "records-lectures"], author_netid: "stub_user_03", verified: true, moderation_passed: true },
  { professor_id: "kim-sarah", course_code: "CSS 385", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 3, difficulty: 3, would_take_again: true, body: "Decent class. Some lectures were a bit dry but she's clearly knowledgeable. Would have liked more feedback on assignments rather than just a grade.", tags: ["knowledgeable"], author_netid: "stub_user_04", verified: true, moderation_passed: true },
  { professor_id: "kim-sarah", course_code: "CSS 487", campus: "UW Bothell", quarter: "Spring", year: 2023, rating: 5, difficulty: 2, would_take_again: true, body: "One of my favorite instructors at UWB. She makes cloud computing fun. The final project deploying a microservice was real-world experience I actually put on my resume.", tags: ["project-based", "engaging-lecturer", "industry-relevant"], author_netid: "stub_user_05", verified: true, moderation_passed: true },
  { professor_id: "kim-sarah", course_code: "CSS 342", campus: "UW Bothell", quarter: "Fall", year: 2024, rating: 4, difficulty: 3, would_take_again: true, body: "Fair grader. The rubrics are clear so you know exactly what's expected. I liked how she tied theory to current industry practices.", tags: ["clear-rubrics", "engaging-lecturer"], author_netid: "stub_user_06", verified: true, moderation_passed: true },
  { professor_id: "nguyen-michael", course_code: "CSS 343", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 3, difficulty: 5, would_take_again: false, body: "Professor Nguyen knows his stuff but moves extremely fast. If you're not already comfortable with algorithms this class will hurt. Office hours helped a lot but attendance is basically required.", tags: ["tough-grader", "fast-paced", "knowledgeable"], author_netid: "stub_user_07", verified: true, moderation_passed: true },
  { professor_id: "nguyen-michael", course_code: "CSS 501", campus: "UW Bothell", quarter: "Fall", year: 2023, rating: 4, difficulty: 4, would_take_again: true, body: "Graduate-level content delivered clearly. He expects you to do the readings before class. The problem sets are hard but good prep for technical interviews.", tags: ["tough-grader", "interview-prep", "knowledgeable"], author_netid: "stub_user_08", verified: true, moderation_passed: true },
  { professor_id: "nguyen-michael", course_code: "CSS 143", campus: "UW Bothell", quarter: "Spring", year: 2024, rating: 4, difficulty: 3, would_take_again: true, body: "Good intro class. He's patient with beginners and adjusts his explanation style when students look confused. Homeworks build nicely on each other.", tags: ["patient", "beginner-friendly"], author_netid: "stub_user_09", verified: true, moderation_passed: true },
  { professor_id: "patel-anita", course_code: "CSS 484", campus: "UW Bothell", quarter: "Spring", year: 2024, rating: 5, difficulty: 3, would_take_again: true, body: "Dr. Patel is the best professor I've had at UWB. She makes machine learning accessible without dumbing it down. The Kaggle competition final project was a highlight.", tags: ["engaging-lecturer", "project-based", "inspiring"], author_netid: "stub_user_10", verified: true, moderation_passed: true },
  { professor_id: "patel-anita", course_code: "CSS 484", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 5, difficulty: 3, would_take_again: true, body: "Incredibly passionate about AI. Her enthusiasm is contagious. She stays after class to discuss ideas and genuinely cares about where her students end up after graduation.", tags: ["inspiring", "engaging-lecturer", "helpful-office-hours"], author_netid: "stub_user_11", verified: true, moderation_passed: true },
  { professor_id: "patel-anita", course_code: "CSS 581", campus: "UW Bothell", quarter: "Fall", year: 2023, rating: 5, difficulty: 4, would_take_again: true, body: "Rigorous and rewarding. You will write a lot of Python. The research paper she assigns is tough but teaches you how to actually read ML literature. Highly recommend.", tags: ["research-focused", "tough-grader", "inspiring"], author_netid: "stub_user_12", verified: true, moderation_passed: true },
  { professor_id: "patel-anita", course_code: "CSS 490", campus: "UW Bothell", quarter: "Spring", year: 2023, rating: 4, difficulty: 2, would_take_again: true, body: "Capstone class with her was great. She gave useful feedback on our project proposal and connected us with industry mentors. One of the most practical courses I took.", tags: ["project-based", "industry-relevant", "supportive"], author_netid: "stub_user_13", verified: true, moderation_passed: true },
  { professor_id: "patel-anita", course_code: "CSS 484", campus: "UW Bothell", quarter: "Fall", year: 2024, rating: 5, difficulty: 3, would_take_again: true, body: "Take this class. The content is relevant, the professor is brilliant, and you'll actually use what you learn. She references current research papers in every lecture.", tags: ["research-focused", "engaging-lecturer", "industry-relevant"], author_netid: "stub_user_14", verified: true, moderation_passed: true },
  { professor_id: "lee-jessica", course_code: "CSS 332", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 5, difficulty: 2, would_take_again: true, body: "Professor Lee's HCI class changed how I think about software. Very clear expectations, lots of real-world examples. The user study project was eye-opening.", tags: ["clear-rubrics", "engaging-lecturer", "project-based"], author_netid: "stub_user_15", verified: true, moderation_passed: true },
  { professor_id: "lee-jessica", course_code: "CSS 301", campus: "UW Seattle", quarter: "Spring", year: 2024, rating: 4, difficulty: 2, would_take_again: true, body: "She's a great communicator and makes accessibility concepts stick. The reading load is heavier than expected for a 300-level but worth it.", tags: ["engaging-lecturer", "heavy-reading"], author_netid: "stub_user_16", verified: true, moderation_passed: true },
  { professor_id: "lee-jessica", course_code: "CSS 475", campus: "UW Bothell", quarter: "Fall", year: 2023, rating: 5, difficulty: 3, would_take_again: true, body: "One of the most thoughtful professors I've had. She designs assignments that genuinely test your understanding rather than memorization. Active learning in every class.", tags: ["engaging-lecturer", "project-based", "supportive"], author_netid: "stub_user_17", verified: true, moderation_passed: true },
  { professor_id: "rodriguez-carlos", course_code: "CSS 430", campus: "UW Bothell", quarter: "Fall", year: 2023, rating: 3, difficulty: 5, would_take_again: false, body: "Very hard class. He doesn't curve and the exams are brutal. That said, if you put in the work you'll come out understanding OS concepts deeply. Just be ready for a tough quarter.", tags: ["tough-grader", "no-curve", "knowledgeable"], author_netid: "stub_user_18", verified: true, moderation_passed: true },
  { professor_id: "rodriguez-carlos", course_code: "CSS 422", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 2, difficulty: 5, would_take_again: false, body: "Not a great experience. Lectures feel unorganized and he goes off on tangents. The material is interesting but I had to rely on the textbook and YouTube to actually learn.", tags: ["disorganized", "fast-paced"], author_netid: "stub_user_19", verified: true, moderation_passed: true },
  { professor_id: "park-hyunjin", course_code: "CSS 475", campus: "UW Bothell", quarter: "Spring", year: 2024, rating: 4, difficulty: 3, would_take_again: true, body: "Great database course. The SQL assignments scale in complexity perfectly. She's very responsive on Canvas and gives detailed feedback.", tags: ["helpful-office-hours", "clear-rubrics", "knowledgeable"], author_netid: "stub_user_20", verified: true, moderation_passed: true },
  { professor_id: "park-hyunjin", course_code: "CSS 480", campus: "UW Bothell", quarter: "Fall", year: 2023, rating: 5, difficulty: 3, would_take_again: true, body: "Hyunjin is thorough and organized. Every lecture has a clear structure. The final project building a full database-backed app was challenging but very satisfying.", tags: ["organized", "project-based", "engaging-lecturer"], author_netid: "stub_user_21", verified: true, moderation_passed: true },
  { professor_id: "park-hyunjin", course_code: "CSS 533", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 4, difficulty: 4, would_take_again: true, body: "Solid professor. Graduate-level database theory is dense but she explains it well. Would appreciate more worked examples but overall a good learning experience.", tags: ["knowledgeable", "organized"], author_netid: "stub_user_22", verified: true, moderation_passed: true },
  { professor_id: "wright-thomas", course_code: "CSS 432", campus: "UW Bothell", quarter: "Spring", year: 2024, rating: 4, difficulty: 4, would_take_again: true, body: "His networking background from Microsoft is really evident. Real-world examples make abstract protocols click. The socket programming assignments are tough but memorable.", tags: ["industry-relevant", "knowledgeable", "project-based"], author_netid: "stub_user_23", verified: true, moderation_passed: true },
  { professor_id: "wright-thomas", course_code: "CSS 486", campus: "UW Bothell", quarter: "Winter", year: 2024, rating: 4, difficulty: 3, would_take_again: true, body: "Security class was well-structured. He keeps content current — referenced real CVEs from last year. Grading is fair and he gives partial credit.", tags: ["industry-relevant", "fair-grader", "organized"], author_netid: "stub_user_24", verified: true, moderation_passed: true },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding Firestore...\n");

  for (const prof of PROFESSORS) {
    const { id, ...data } = prof;
    await db.collection("professors").doc(id).set(data);
    console.log(`  ✅ Professor: ${data.name} [${data.campus.join(", ")}]`);
  }

  console.log("");

  const acc: Record<string, { sum: number; count: number }> = {};

  for (const review of REVIEWS) {
    const { professor_id, course_code, campus, quarter, year, author_netid, ...rest } = review;

    // composite key includes campus — prevents duplicate per netid+prof+course+campus+quarter
    const docId = `${author_netid}_${professor_id}_${course_code}_${campus.replace(/\s/g, "")}_${quarter}${year}`;

    await db.collection("reviews").doc(docId).set({
      professor_id, course_code, campus, quarter, year,
      author_id: author_netid,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      ...rest,
    });

    if (!acc[professor_id]) acc[professor_id] = { sum: 0, count: 0 };
    acc[professor_id].sum += review.rating;
    acc[professor_id].count += 1;

    const badge = review.verified ? "✅ verified  " : "⚠️  unverified";
    console.log(`  ${badge} — ${professor_id} · ${course_code} · ${campus} (${review.rating}★)`);
  }

  console.log("\n📊 Updating professor aggregates...\n");

  for (const [profId, { sum, count }] of Object.entries(acc)) {
    const avg = Math.round((sum / count) * 10) / 10;
    await db.collection("professors").doc(profId).update({ overall_rating: avg, ratings_count: count });
    console.log(`  ✅ ${profId}: ${avg} avg over ${count} reviews`);
  }

  console.log("\n✨ Seed complete.\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
