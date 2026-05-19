// app/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "firebase/auth";

import AuthGuard from "@/components/AuthGuard";
import { signOutCurrentUser } from "@/lib/auth";
import { auth } from "@/lib/firebaseClient";

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

  async function handleLogout() {
    setLoggingOut(true);
    await signOutCurrentUser();
    router.replace("/login");
  }

  // TODO: TESTING ONLY — remove before merging to main
  async function handleGetToken() {
    const token = await auth.currentUser?.getIdToken();
    console.log("TOKEN:", token);
    alert("Token copied to console (Cmd+Option+J)");
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? user.email ?? "Profile"}
              className="h-12 w-12 rounded-full border border-gray-200"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-husky-light text-husky-purple">
              <span className="text-lg font-semibold">
                {(user.displayName ?? user.email ?? "U")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-husky-purple">
              Welcome, {user.displayName ?? "Husky"}
            </h1>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* TODO: TESTING ONLY — remove before merging to main */}
          <button
            type="button"
            onClick={handleGetToken}
            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Get Token (dev)
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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

        {/* ── Placeholder cards ── */}
        <PlaceholderCard
          title="Submit Review"
          body="Post a structured review with ratings, difficulty, and written feedback."
        />
        <PlaceholderCard
          title="AI Review Summaries"
          body="Skim long review threads with model-generated overviews."
        />
        <PlaceholderCard
          title="IASystem Ratings"
          body="View numerical ordinal ratings from official course evaluations."
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
      className="rounded-lg border border-husky-purple/30 bg-white p-5 text-left shadow-sm transition hover:border-husky-purple hover:shadow-md focus:outline-none focus:ring-2 focus:ring-husky-purple"
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="rounded-full bg-husky-light px-2 py-0.5 text-xs font-medium text-husky-purple">
          Live
        </span>
      </div>
      <h3 className="mt-3 font-semibold text-husky-purple">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </button>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5">
      <h3 className="font-semibold text-husky-purple">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
      <span className="mt-3 inline-block rounded-full bg-husky-light px-2 py-0.5 text-xs font-medium text-husky-metallic">
        Coming soon
      </span>
    </div>
  );
}
