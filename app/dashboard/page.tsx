// app/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "firebase/auth";

import AuthGuard from "@/components/AuthGuard";
import ProfessorSearchModal from "@/components/ProfessorSearchModal";
import { signOutCurrentUser } from "@/lib/auth";

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
  const [searchMode, setSearchMode] = useState<"review" | "ias" | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    await signOutCurrentUser();
    router.replace("/login");
  }

  return (
    <section className="space-y-8">
      <ProfessorSearchModal
        open={searchMode !== null}
        mode={searchMode ?? "review"}
        onClose={() => setSearchMode(null)}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? user.email ?? "Profile"}
              className="h-12 w-12 rounded-full border border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-husky-light dark:bg-husky-purple/20 text-husky-purple dark:text-husky-purpleLight">
              <span className="text-lg font-semibold">
                {(user.displayName ?? user.email ?? "U")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-husky-purple dark:text-husky-purpleLight">
              Welcome, {user.displayName ?? "Husky"}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Log out"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ── Active card: Browse Professors ── */}
        <ActionCard
          title="Browse Professors"
          body="Search UW professors by name, course, or campus."
          icon="🔍"
          onClick={() => router.push("/search")}
        />

        {/* ── Active card: Submit Review ── */}
        <ActionCard
          title="Submit Review"
          body="Post a structured review with ratings, difficulty, and written feedback."
          icon="✏️"
          onClick={() => setSearchMode("review")}
        />

        {/* ── Active card: IASystem Ratings ── */}
        <ActionCard
          title="IASystem Ratings"
          body="View numerical ordinal ratings from official course evaluations."
          icon="🏛️"
          onClick={() => setSearchMode("ias")}
        />

        {/* ── Placeholder cards ── */}
        <PlaceholderCard
          title="AI Review Summaries"
          body="Skim long review threads with model-generated overviews."
        />
      </div>
    </section>
  );
}

function ActionCard({
  title,
  body,
  icon,
  onClick,
}: {
  title: string;
  body: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-husky-purple/30 bg-white dark:bg-gray-800 p-5 text-left shadow-sm transition hover:border-husky-purple hover:shadow-md focus:outline-none focus:ring-2 focus:ring-husky-purple"
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="rounded-full bg-husky-light dark:bg-husky-purple/20 px-2 py-0.5 text-xs font-medium text-husky-purple dark:text-husky-purpleLight">
          Live
        </span>
      </div>
      <h3 className="mt-3 font-semibold text-husky-purple dark:text-husky-purpleLight">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{body}</p>
    </button>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-5">
      <h3 className="font-semibold text-husky-purple dark:text-husky-purpleLight">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</p>
      <span className="mt-3 inline-block rounded-full bg-husky-light dark:bg-husky-purple/20 px-2 py-0.5 text-xs font-medium text-husky-metallic dark:text-husky-gold">
        Coming soon
      </span>
    </div>
  );
}
