"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { subscribeToAuth } from "@/lib/auth";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Spinner />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return user ? <SignedInHome user={user} /> : <SignedOutHome />;
}

function SignedInHome({ user }: { user: User }) {
  const firstName = (user.displayName ?? "Husky").split(" ")[0];

  return (
    <section className="space-y-8">
      <div className="rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-husky-purple sm:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-700">
          You&apos;re signed in as{" "}
          <span className="font-medium">{user.email}</span>. Browse professors,
          read verified student reviews, and share your own feedback.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90"
          >
            Go to dashboard
          </Link>
          <Link
            href="/search"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Browse professors
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          title="Verified students"
          body="Only Google accounts ending in @uw.edu can sign in, so you know reviews come from real Huskies."
        />
        <FeatureCard
          title="Structured reviews"
          body="Course code, difficulty, would-take-again, tags, and a written review — built to feel familiar."
        />
        <FeatureCard
          title="AI summaries"
          body="Skim long review threads with model-generated overviews of qualitative and quantitative feedback."
        />
      </div>
    </section>
  );
}

function SignedOutHome() {
  return (
    <section className="space-y-8">
      <div className="rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-husky-purple sm:text-4xl">
          Rate My Husky
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-700">
          A verified UW-only professor review platform. Sign in with your{" "}
          <span className="font-medium">@uw.edu</span> Google account to browse
          professors, read student reviews, and see AI-generated summaries of
          course feedback.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90"
          >
            Sign in with UW Google
          </Link>
          <Link
            href="/about"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Learn more
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          title="Verified students"
          body="Only Google accounts ending in @uw.edu can sign in, so you know reviews come from real Huskies."
        />
        <FeatureCard
          title="Structured reviews"
          body="Course code, difficulty, would-take-again, tags, and a written review — built to feel familiar."
        />
        <FeatureCard
          title="AI summaries"
          body="Skim long review threads with model-generated overviews of qualitative and quantitative feedback."
        />
      </div>
    </section>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-husky-purple">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-husky-purple border-t-transparent"
    />
  );
}
