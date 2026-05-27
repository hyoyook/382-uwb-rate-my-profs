import { collection, getDocs, limit, query, where } from "firebase/firestore";

import { db } from "@/lib/firebaseClient";

async function hasProfessorRecordByEmail(email: string): Promise<boolean> {
  const exactSnap = await getDocs(
    query(
      collection(db, "professors"),
      where("email", "==", email),
      limit(1),
    ),
  );
  if (!exactSnap.empty) return true;

  const lower = email.toLowerCase();
  if (lower === email) return false;

  const lowerSnap = await getDocs(
    query(
      collection(db, "professors"),
      where("email", "==", lower),
      limit(1),
    ),
  );
  return !lowerSnap.empty;
}

export async function canUserWriteReviews(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const isProfessor = await hasProfessorRecordByEmail(email.trim());
  return !isProfessor;
}
