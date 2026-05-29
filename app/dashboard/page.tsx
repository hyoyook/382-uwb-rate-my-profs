// app/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection, doc, getDoc, query, where, orderBy, limit, getDocs, getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

import AuthGuard from "@/components/AuthGuard";
import ProfessorSearchModal from "@/components/ProfessorSearchModal";
import { signOutCurrentUser } from "@/lib/auth";
import { canUserWriteReviews } from "@/lib/reviewEligibility";

type ReviewAccessState = "checking" | "allowed" | "blocked";

type UserReview = {
  id: string;
  professor_id: string;
  professor_name?: string; // resolved after fetch
  body: string;
  course: { code: string; name: string };
  term: { quarter: string; year: number };
  scores: { overall: number };
  created_at: { seconds: number } | null;
};

type RecentProfessor = {
  id: string;
  name: string;
  department: string;
  overall_rating: number;
  ratings_count: number;
};

export default function DashboardPage() {
  return (
    <AuthGuard>
      {(user) => <DashboardView user={user} />}
    </AuthGuard>
  );
}

function DashboardView({ user }: { user: User }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewAccess, setReviewAccess] = useState<ReviewAccessState>("checking");
  const [userReviews, setUserReviews] = useState<UserReview[]>([]);
  const [recentProfessors, setRecentProfessors] = useState<RecentProfessor[]>([]);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [profCount, setProfCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    canUserWriteReviews(user.email)
      .then((canWrite) => { if (active) setReviewAccess(canWrite ? "allowed" : "blocked"); })
      .catch(() => { if (active) setReviewAccess("allowed"); });

    // Fetch user's last 5 reviews
    const reviewsQ = query(
      collection(db, "reviews"),
      where("author_id", "==", user.uid),
      orderBy("created_at", "desc"),
      limit(5),
    );
    getDocs(reviewsQ).then(async (snap) => {
      if (!active) return;
      const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserReview));

      // Resolve professor names using doc IDs directly
      const profIds = [...new Set(reviews.map((r) => r.professor_id))];
      const profNames: Record<string, string> = {};
      await Promise.all(
        profIds.map(async (pid) => {
          const profDoc = await getDoc(doc(db, "professors", pid));
          if (profDoc.exists()) {
            profNames[pid] = profDoc.data().name as string;
          }
        })
      );

      if (!active) return;
      setUserReviews(reviews.map((r) => ({
        ...r,
        professor_name: profNames[r.professor_id] ?? r.professor_id.replace(/_/g, " "),
      })));
    });

    // Count user's reviews and unique professors
    const countQ = query(collection(db, "reviews"), where("author_id", "==", user.uid));
    getCountFromServer(countQ).then((snap) => {
      if (active) setReviewCount(snap.data().count);
    });
    const profCountQ = query(collection(db, "reviews"), where("author_id", "==", user.uid));
    getDocs(profCountQ).then((snap) => {
      if (!active) return;
      const unique = new Set(snap.docs.map((d) => d.data().professor_id));
      setProfCount(unique.size);
    });

    // Fetch recently active(reviwed) professors
    const profsQ = query(
      collection(db, "professors"),
      orderBy("ratings_count", "desc"),
      limit(3),
    );
    getDocs(profsQ).then((snap) => {
      if (!active) return;
      setRecentProfessors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecentProfessor)));
    });

    return () => { active = false; };
  }, [user.email]);

  async function handleLogout() {
    setLoggingOut(true);
    await signOutCurrentUser();
    router.replace("/login");
  }

  const initials = (user.displayName ?? user.email ?? "U")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const formatPosted = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="space-y-6">
      <ProfessorSearchModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
      />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? user.email ?? "Profile"}
              className="h-11 w-11 rounded-full border border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-husky-light dark:bg-husky-purple/20 text-husky-purple dark:text-husky-purpleLight flex-shrink-0">
              <span className="text-sm font-semibold">{initials}</span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
              {user.displayName ?? "Husky"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
              {reviewCount !== null && (
                <><span className="font-medium">{reviewCount}</span>{" "}
                  <span className="text-gray-500 dark:text-gray-400">reviews submitted</span></>
              )}
              {reviewCount !== null && profCount !== null && (
                <span className="mx-3 text-gray-300 dark:text-gray-600">·</span>
              )}
              {profCount !== null && (
                <><span className="font-medium">{profCount}</span>{" "}
                  <span className="text-gray-500 dark:text-gray-400">professors reviewed</span></>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-60"
        >
          {loggingOut ? "Signing out…" : "Log out"}
        </button>
      </header>

      {/* ── Nav cards ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => router.push("/search")}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left flex items-center justify-between gap-4 hover:border-husky-purple/50 transition"
        >
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">🔍 Browse professors</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Search by name, course, or campus.</p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setReviewModalOpen(true)}
          disabled={reviewAccess !== "allowed"}
          className={`rounded-lg border bg-white dark:bg-gray-800 p-4 text-left flex items-center justify-between gap-4 transition ${reviewAccess !== "allowed"
            ? "border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed"
            : "border-gray-200 dark:border-gray-700 hover:border-husky-purple/50"
            }`}
        >
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">✏️ Submit a review</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {reviewAccess === "blocked"
                ? "Professor accounts cannot submit reviews."
                : "Post ratings, difficulty, and written feedback."}
            </p>
          </div>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border ${reviewAccess === "blocked"
            ? "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
            : "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-700 dark:text-green-400"
            }`}>
            {reviewAccess === "blocked" ? "Restricted" : "Live"}
          </span>
        </button>
      </div>

      {/* ── Divider ── */}
      <hr className="border-gray-100 dark:border-gray-800" />

      {/* ── Reviews + Recent professors ── */}
      <div className="grid gap-8 sm:grid-cols-2">
        {/* Your reviews */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Your reviews
          </p>
          {userReviews.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {userReviews.map((r) => (
                <li
                  key={r.id}
                  className="py-2.5 cursor-pointer group"
                  onClick={() => router.push(`/professors/${r.professor_id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-husky-purple dark:group-hover:text-husky-purpleLight transition">
                        {r.professor_name ?? r.professor_id.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {r.course.code} · {r.term.quarter} {r.term.year}
                      </p>
                      {r.body && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {r.body}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Stars rating={r.scores.overall} />
                      {r.created_at && (
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          {formatPosted(r.created_at.seconds)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recently reviewed professors */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Recently reviewed professors
          </p>
          {recentProfessors.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentProfessors.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2.5 cursor-pointer group"
                  onClick={() => router.push(`/professors/${p.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-husky-purple dark:group-hover:text-husky-purpleLight transition">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.department} · {p.ratings_count} reviews
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-shrink-0">
                    {p.overall_rating.toFixed(1)}
                  </span>
                  <div className="w-10 h-0.5 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-400 dark:bg-gray-500 rounded-full"
                      style={{ width: `${(p.overall_rating / 5) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-xs tracking-wide">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}>★</span>
      ))}
    </span>
  );
}
