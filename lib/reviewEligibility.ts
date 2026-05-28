import { auth } from "@/lib/firebaseClient";

export async function canUserWriteReviews(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;

  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[reviewEligibility] No current user while checking review eligibility");
    return false;
  }

  try {
    const token = await currentUser.getIdToken(true);
    const res = await fetch("/api/auth/review-eligibility", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[reviewEligibility] Eligibility API failed", {
        status: res.status,
      });
      return true;
    }

    const data = (await res.json()) as { canWriteReviews?: boolean };
    return data.canWriteReviews !== false;
  } catch (err) {
    console.error("[reviewEligibility] Eligibility API request failed", err);
    return true;
  }
}
