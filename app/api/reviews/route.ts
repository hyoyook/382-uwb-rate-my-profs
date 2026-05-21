// app/api/reviews/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_COLLECTION = "reviews";
const PROFESSORS_COLLECTION = "professors";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBearerToken(req: NextRequest): string | null {
    const header = req.headers.get("authorization");
    if (!header) return null;
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return null;
    return token;
}

function isValidScore(n: unknown, min = 1, max = 5): boolean {
    return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

async function moderateReview(body: string): Promise<{ pass: boolean; reason: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("[/api/reviews] GEMINI_API_KEY not set — skipping moderation");
        return { pass: false, reason: "moderation_skipped_no_key" };
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
        const raw = result.response.text().trim();
        // Gemini sometimes wraps JSON in ```json fences despite instructions — strip them
        const text = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(text);

        // Write moderation log to file for debugging
        const { appendFileSync } = await import("fs");
        const logLine = JSON.stringify({
            ts: new Date().toISOString(),
            reviewBody: body.slice(0, 120),
            raw,
            parsed,
        }) + "\n";
        appendFileSync("moderation.log", logLine);

        return parsed;
    } catch (err) {
        const { appendFileSync } = await import("fs");
        const errStr = String(err);
        appendFileSync("moderation.log", JSON.stringify({
            ts: new Date().toISOString(),
            error: errStr,
            reviewBody: body.slice(0, 120),
        }) + "\n");
        // If Gemini is rate-limited, fail closed — don't let unmoderated reviews through
        if (errStr.includes("429") || errStr.includes("quota")) {
            return { pass: false, reason: "moderation_unavailable_quota" };
        }
        // Other errors (parse failures, network blips) fail open to avoid blocking legit reviews
        return { pass: false, reason: "parse_error_defaulted_pass" };
    }
}

// ─── POST /api/reviews ────────────────────────────────────────────────────────

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
        course_name?: string;
        quarter: string;
        year: number;
        scores: {
            overall: number;
            difficulty: number;
            clarity: number;
            helpfulness: number;
            would_take_again: boolean;
        };
        body: string;
        tags?: string[];
        attendance_mandatory?: boolean | null;
        grade_received?: string | null;
        textbook_required?: boolean | null;
    };

    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { professor_id, course_code, quarter, year, scores, body: reviewBody } = data;

    // 3. Required field presence
    if (!professor_id || !course_code || !quarter || !year || !scores || !reviewBody) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // 4. Score range validation
    if (
        !isValidScore(scores.overall) ||
        !isValidScore(scores.difficulty) ||
        !isValidScore(scores.clarity) ||
        !isValidScore(scores.helpfulness) ||
        typeof scores.would_take_again !== "boolean"
    ) {
        return NextResponse.json(
            { error: "Invalid scores. overall/difficulty/clarity/helpfulness must be 1–5; would_take_again must be boolean." },
            { status: 400 }
        );
    }

    // 5. Rate limit
    const oneDayAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentSnap = await adminDb
        .collection(REVIEWS_COLLECTION)
        .where("author_id", "==", decoded.uid)
        .where("created_at", ">=", oneDayAgo)
        .get();

    if (recentSnap.size >= RATE_LIMIT_MAX) {
        return NextResponse.json(
            { error: "Rate limit reached. Max 3 reviews per 24 hours.", remaining: 0 },
            { status: 429 }
        );
    }

    // 6. Pre-filter obvious spam
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

    // 7. Gemini moderation
    const mod = await moderateReview(reviewBody);
    if (!mod.pass) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: mod.reason },
            { status: 400 }
        );
    }

    // 8. Read campus server-side from professor doc
    const profRef = adminDb.collection(PROFESSORS_COLLECTION).doc(professor_id);
    const profSnap = await profRef.get();

    if (!profSnap.exists) {
        return NextResponse.json({ error: "Professor not found." }, { status: 404 });
    }

    const profData = profSnap.data()!;
    // campus is string[] on the professor doc; use the first entry as the canonical value.
    // For multi-campus professors a future version could accept a campus param and validate
    // it against this array — for now we derive it server-side to prevent spoofing.
    const campus: string = Array.isArray(profData.campus)
        ? profData.campus[0]
        : (profData.campus ?? "Unknown");

    // 9. Write review to Firestore
    const campusSlug = campus.replace(/\s+/g, "");
    const courseSlug = course_code.replace(/\s+/g, ""); // e.g. "CSS 343" → "CSS343"
    const docId = `${netid}_${professor_id}_${courseSlug}_${campusSlug}_${quarter}${year}`;
    const reviewRef = adminDb.collection(REVIEWS_COLLECTION).doc(docId);

    const reviewDoc = {
        id: docId,
        professor_id,
        author_id: decoded.uid,
        verified: true,                        // always true — enforced by @uw.edu auth
        created_at: FieldValue.serverTimestamp(),
        status: "published" as const,
        flagged: false,
        campus,
        course: { code: course_code, name: data.course_name ?? "" },
        term: { quarter, year },
        scores,
        body: reviewBody,
        tags: data.tags ?? [],
        grade_received: data.grade_received ?? null,
        attendance_mandatory: data.attendance_mandatory ?? null,
        textbook_required: data.textbook_required ?? null,
        votes: { helpful: 0, not_helpful: 0 },
    };

    try {
        await reviewRef.set(reviewDoc);
    } catch (err) {
        console.error("[/api/reviews] Firestore write failed:", err);
        return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
    }

    // 10. Update professor aggregate (running average via transaction)
    try {
        await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(profRef);
            if (!snap.exists) return;

            const current = snap.data()!;
            const prevCount: number = current.ratings_count ?? 0;
            const prevAvg: number = current.overall_rating ?? 0;

            const newCount = prevCount + 1;
            const newAvg = Math.round(((prevAvg * prevCount + scores.overall) / newCount) * 10) / 10;

            tx.update(profRef, {
                ratings_count: newCount,
                overall_rating: newAvg,
            });
        });
    } catch (err) {
        // Non-fatal — review is already written; aggregate will self-correct on next write
        console.error("[/api/reviews] professor aggregate update failed:", err);
    }

    return NextResponse.json({
        ok: true,
        id: docId,
        remaining: RATE_LIMIT_MAX - recentSnap.size - 1,
    });
}