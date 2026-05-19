// app/api/reviews/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// ← removed top-level import of flashModel

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_COLLECTION = "reviews";
const PROFESSORS_COLLECTION = "professors";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function extractBearerToken(req: NextRequest): string | null {
    const header = req.headers.get("authorization");
    if (!header) return null;
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return null;
    return token;
}

async function moderateReview(body: string): Promise<{ pass: boolean; reason: string }> {
    // ← lazy init inside the function — only runs at request time, never at build time
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("[/api/reviews] GEMINI_API_KEY not set — skipping moderation");
        return { pass: true, reason: "moderation_skipped_no_key" };
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `
You are a strict content moderator for a university professor review platform.
Reject ANY review that meets one or more of these conditions:
- Contains promotional content, links, or spam (e.g. "buy my crypto", "visit my site")
- Is a personal attack with zero academic content
- Contains no mention of teaching, course content, workload, exams, or classroom experience
- Is gibberish or completely off-topic

A review ONLY passes if it contains specific, genuine feedback about a professor's teaching or a course experience.

Reply with JSON only, no markdown:
{ "pass": boolean, "reason": string }

Review: "${body.replace(/"/g, '\\"')}"
`.trim();

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        return JSON.parse(text);
    } catch (err) {
        console.error("[/api/reviews] moderation parse error:", err);
        return { pass: true, reason: "parse_error_defaulted_pass" };
    }
}

export async function POST(req: NextRequest) {
    // 1. Auth
    const idToken = extractBearerToken(req);
    if (!idToken) {
        return NextResponse.json({ error: "Missing Authorization bearer token." }, { status: 401 });
    }

    let decoded;
    try {
        decoded = await adminAuth.verifyIdToken(idToken, true);
    } catch (err) {
        console.error("[/api/reviews] verifyIdToken failed:", err);
        return NextResponse.json({ error: "Invalid or expired ID token." }, { status: 401 });
    }

    const netid = decoded.email?.split("@")[0] ?? decoded.uid;

    // 2. Parse body
    let data: {
        professor_id: string;
        course_code: string;
        course_name: string;
        quarter: string;
        year: number;
        scores: { overall: number; difficulty: number; clarity: number; helpfulness: number; would_take_again: boolean };
        body: string;
        tags?: string[];
        attendance_mandatory?: boolean;
        grade_received?: string;
        textbook_required?: boolean;
    };

    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { professor_id, course_code, quarter, year, scores, body: reviewBody } = data;
    if (!professor_id || !course_code || !quarter || !year || !scores || !reviewBody) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // 3. Rate limit
    const oneDayAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentSnap = await adminDb
        .collection(REVIEWS_COLLECTION)
        .where("author_id", "==", decoded.uid)
        .where("created_at", ">=", oneDayAgo)
        .get();

    if (recentSnap.size >= RATE_LIMIT_MAX) {
        return NextResponse.json(
            { error: "Rate limit reached. Max 3 reviews per 24 hours." },
            { status: 429 }
        );
    }

    // 4. Pre-filter obvious spam
    const spamPatterns = [
        /buy\s+my/i,
        /crypto/i,
        /http/i,
        /\bsucks\b/i,
        /^[a-z\s]{1,6}(\s[a-z]{1,6}){3,}$/i,
    ];
    if (spamPatterns.some((p) => p.test(reviewBody))) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: "Contains spam or prohibited content." },
            { status: 400 }
        );
    }

    // 5. Gemini moderation
    const mod = await moderateReview(reviewBody);
    if (!mod.pass) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: mod.reason },
            { status: 400 }
        );
    }

    // 6. Write to Firestore
    const docId = `${netid}_${professor_id}_${course_code}_${quarter}${year}`;
    const ref = adminDb.collection(REVIEWS_COLLECTION).doc(docId);

    const reviewDoc = {
        id: docId,
        professor_id,
        author_id: decoded.uid,
        created_at: FieldValue.serverTimestamp(),
        course: { code: course_code, name: data.course_name ?? "" },
        term: { quarter, year },
        scores,
        body: reviewBody,
        tags: data.tags ?? [],
        attendance_mandatory: data.attendance_mandatory ?? false,
        grade_received: data.grade_received ?? null,
        textbook_required: data.textbook_required ?? false,
        votes: { helpful: 0, not_helpful: 0 },
        flagged: false,
        status: "published",
    };

    try {
        await ref.set(reviewDoc);
    } catch (err) {
        console.error("[/api/reviews] Firestore write failed:", err);
        return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
    }

    // 7. Update professor aggregate
    try {
        const profRef = adminDb.collection(PROFESSORS_COLLECTION).doc(professor_id);
        await profRef.update({
            ratings_count: FieldValue.increment(1),
            overall_rating: scores.overall, // TODO: replace with running average in Phase 3
        });
    } catch (err) {
        console.error("[/api/reviews] professor aggregate update failed:", err);
    }

    return NextResponse.json({ ok: true, id: docId });
}
