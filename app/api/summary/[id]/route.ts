// app/api/summary/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { flashModel } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_COLLECTION = "reviews";
const PROFESSORS_COLLECTION = "professors";
const MIN_VERIFIED = 5;
const SAMPLE_RECENT = 5;
const SAMPLE_RANDOM = 5;

function extractBearerToken(req: NextRequest): string | null {
    const header = req.headers.get("authorization");
    if (!header) return null;
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return null;
    return token;
}

/** Fisher-Yates sample — returns up to n items picked at random from arr */
function sampleRandom<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
}

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    // 1. Auth
    const idToken = extractBearerToken(req);
    if (!idToken) {
        return NextResponse.json({ error: "Missing Authorization bearer token." }, { status: 401 });
    }
    try {
        await adminAuth.verifyIdToken(idToken, true);
    } catch {
        return NextResponse.json({ error: "Invalid or expired ID token." }, { status: 401 });
    }

    const professorId = params.id;

    // 2. Fetch all verified reviews for this professor
    const reviewsSnap = await adminDb
        .collection(REVIEWS_COLLECTION)
        .where("professor_id", "==", professorId)
        .where("verified", "==", true)
        .get();

    if (reviewsSnap.size < MIN_VERIFIED) {
        return NextResponse.json(
            { error: `Not enough verified reviews. Need ${MIN_VERIFIED}, have ${reviewsSnap.size}.` },
            { status: 400 }
        );
    }

    // 3. Select reviews: 5 most recent + up to 5 random from the rest
    const sorted = reviewsSnap.docs
        .map((d) => d.data())
        .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0));

    const recent = sorted.slice(0, SAMPLE_RECENT);
    const rest = sorted.slice(SAMPLE_RECENT);
    const random = sampleRandom(rest, SAMPLE_RANDOM);
    const selected = [...recent, ...random];

    // 4. Build prompt
    const reviewTexts = selected
        .map((r, i) => {
            const s = r.scores;
            const wta = s.would_take_again ? "Yes" : "No";
            return (
                `[${i + 1}] Overall ${s.overall}/5 · Clarity ${s.clarity}/5 · ` +
                `Helpfulness ${s.helpfulness}/5 · Difficulty ${s.difficulty}/5 · Would take again: ${wta}\n` +
                `"${r.body}"`
            );
        })
        .join("\n\n");

    const prompt = `
You are writing a concise AI-generated summary of student reviews for a university professor profile page.

Summarize the following ${selected.length} student reviews in 2–3 sentences. Focus on:
- Teaching style and clarity
- Workload and grading difficulty
- Overall student sentiment and whether they would recommend this professor

Rules:
- Be neutral and factual — only reflect what the reviews actually say
- Do not mention specific students or invent details
- Write in third person (e.g. "Students find…", "Reviewers note…")
- Output plain prose only, no bullet points or headers

Reviews:
${reviewTexts}
`.trim();

    // 5. Call Gemini
    let summary: string;
    try {
        const result = await flashModel.generateContent(prompt);
        summary = result.response.text().trim();
    } catch (err) {
        console.error("[/api/summary] Gemini error:", err);
        return NextResponse.json({ error: "Failed to generate summary." }, { status: 500 });
    }

    // 6. Persist to Firestore (non-fatal if it fails — still return the summary)
    try {
        await adminDb.collection(PROFESSORS_COLLECTION).doc(professorId).update({
            summary,
            summary_updated_at: FieldValue.serverTimestamp(),
            summary_review_count: reviewsSnap.size,
        });
    } catch (err) {
        console.error("[/api/summary] Firestore write failed:", err);
    }

    return NextResponse.json({ summary, review_count: reviewsSnap.size });
}
