import { NextResponse, type NextRequest } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { requireUwUser } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFESSORS_COLLECTION = "professors";

type ProfessorProfileLite = {
  name?: string;
  email?: string;
};

async function findProfessorByEmail(
  email: string,
): Promise<{ id: string; data: ProfessorProfileLite } | null> {
  const normalized = email.trim().toLowerCase();

  const exactSnap = await adminDb
    .collection(PROFESSORS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!exactSnap.empty) {
    const doc = exactSnap.docs[0];
    return { id: doc.id, data: doc.data() as ProfessorProfileLite };
  }

  if (normalized !== email) {
    const normalizedSnap = await adminDb
      .collection(PROFESSORS_COLLECTION)
      .where("email", "==", normalized)
      .limit(1)
      .get();
    if (!normalizedSnap.empty) {
      const doc = normalizedSnap.docs[0];
      return { id: doc.id, data: doc.data() as ProfessorProfileLite };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const authResult = await requireUwUser(req);
  if (!authResult.ok) return authResult.response;

  const { email } = authResult;
  console.log("[/api/auth/review-eligibility] Professor check conducted for email:", email);

  const match = await findProfessorByEmail(email);
  if (match) {
    console.log("[/api/auth/review-eligibility] Professor matched:", {
      professorId: match.id,
      professorName: match.data.name ?? "(unknown)",
      professorEmail: match.data.email ?? email,
    });

    return NextResponse.json(
      {
        canWriteReviews: false,
        reason: "professor_accounts_cannot_review",
        matchedProfessor: {
          id: match.id,
          name: match.data.name ?? null,
          email: match.data.email ?? email,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      },
    );
  }

  console.log("[/api/auth/review-eligibility] Professor check result: no professor match", { email });

  return NextResponse.json(
    { canWriteReviews: true },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    },
  );
}
