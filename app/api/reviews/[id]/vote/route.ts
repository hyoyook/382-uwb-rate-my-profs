// app/api/reviews/[id]/vote/route.ts
// POST /api/reviews/[id]/vote
// Body: { vote: "helpful" | "not_helpful" }
//
// One vote per user, stored as uid in voter_ids array on the review doc.
// Voting again with the same type un-votes. Voting with a different type switches.

import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireUwUser } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const authResult = await requireUwUser(req);
    if (!authResult.ok) return authResult.response;
    const { decoded } = authResult;

    const reviewId = params.id;
    if (!reviewId) {
        return NextResponse.json({ error: "Review ID required." }, { status: 400 });
    }

    let body: { vote: "helpful" | "not_helpful" };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { vote } = body;
    if (vote !== "helpful" && vote !== "not_helpful") {
        return NextResponse.json({ error: 'vote must be "helpful" or "not_helpful".' }, { status: 400 });
    }

    const reviewRef = adminDb.collection("reviews").doc(reviewId);

    try {
        const result = await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(reviewRef);
            if (!snap.exists) throw new Error("not_found");

            const data = snap.data()!;
            const voterIds: string[] = data.voter_ids ?? [];
            const votes: { helpful: number; not_helpful: number } = data.votes ?? { helpful: 0, not_helpful: 0 };

            // Determine current vote state for this user
            const helpfulKey = `voter_helpful_${decoded.uid}`;
            const notHelpfulKey = `voter_not_helpful_${decoded.uid}`;
            const votedHelpful = data[helpfulKey] === true;
            const votedNotHelpful = data[notHelpfulKey] === true;

            // Use per-user vote fields (simpler than searching voter_ids array)
            // voter_helpful_{uid}: boolean, voter_not_helpful_{uid}: boolean
            const updates: Record<string, unknown> = {};

            if (vote === "helpful") {
                if (votedHelpful) {
                    // Un-vote
                    updates[helpfulKey] = FieldValue.delete();
                    updates["votes.helpful"] = Math.max(0, votes.helpful - 1);
                } else {
                    // Vote helpful (and remove not_helpful if previously set)
                    updates[helpfulKey] = true;
                    updates["votes.helpful"] = votes.helpful + 1;
                    if (votedNotHelpful) {
                        updates[notHelpfulKey] = FieldValue.delete();
                        updates["votes.not_helpful"] = Math.max(0, votes.not_helpful - 1);
                    }
                }
            } else {
                if (votedNotHelpful) {
                    // Un-vote
                    updates[notHelpfulKey] = FieldValue.delete();
                    updates["votes.not_helpful"] = Math.max(0, votes.not_helpful - 1);
                } else {
                    // Vote not_helpful (and remove helpful if previously set)
                    updates[notHelpfulKey] = true;
                    updates["votes.not_helpful"] = votes.not_helpful + 1;
                    if (votedHelpful) {
                        updates[helpfulKey] = FieldValue.delete();
                        updates["votes.helpful"] = Math.max(0, votes.helpful - 1);
                    }
                }
            }

            tx.update(reviewRef, updates);

            // Return the new vote state
            const newHelpful =
                vote === "helpful"
                    ? votedHelpful
                        ? votes.helpful - 1
                        : votes.helpful + 1
                    : votedHelpful
                    ? votes.helpful - 1
                    : votes.helpful;
            const newNotHelpful =
                vote === "not_helpful"
                    ? votedNotHelpful
                        ? votes.not_helpful - 1
                        : votes.not_helpful + 1
                    : votedNotHelpful
                    ? votes.not_helpful - 1
                    : votes.not_helpful;

            return {
                votes: {
                    helpful: Math.max(0, newHelpful),
                    not_helpful: Math.max(0, newNotHelpful),
                },
                userVote:
                    vote === "helpful"
                        ? votedHelpful ? null : "helpful"
                        : votedNotHelpful ? null : "not_helpful",
            };
        });

        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        if (String(err).includes("not_found")) {
            return NextResponse.json({ error: "Review not found." }, { status: 404 });
        }
        console.error("[/api/reviews/[id]/vote]", err);
        return NextResponse.json({ error: "Failed to record vote." }, { status: 500 });
    }
}
