import { NextResponse, type NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";

import { adminAuth } from "./firebaseAdmin";
import { ALLOWED_EMAIL_DOMAIN, DOMAIN_REJECTION_MESSAGE } from "./authConfig";

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export type RequireUwUserResult =
  | { ok: true; decoded: DecodedIdToken; email: string }
  | { ok: false; response: NextResponse };

/**
 * Verify the bearer ID token and enforce that the caller is a verified
 * @uw.edu account. Use this in every protected API route — the /api/auth/verify
 * route is not a gate, just a UX entry point.
 */
export async function requireUwUser(
  req: NextRequest,
): Promise<RequireUwUserResult> {
  const idToken = extractBearerToken(req);
  if (!idToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing Authorization bearer token." },
        { status: 401 },
      ),
    };
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch (err) {
    console.error("[requireUwUser] verifyIdToken failed:", err);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired ID token." },
        { status: 401 },
      ),
    };
  }

  const email = decoded.email?.toLowerCase() ?? "";
  const emailVerified = decoded.email_verified === true;

  if (!emailVerified || !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: DOMAIN_REJECTION_MESSAGE },
        { status: 403 },
      ),
    };
  }

  return { ok: true, decoded, email };
}
