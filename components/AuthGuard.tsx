"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";

import { isAllowedEmail, signOutCurrentUser, subscribeToAuth } from "@/lib/auth";
import { canUserWriteReviews } from "@/lib/reviewEligibility";

interface Props {
  children: (user: User) => ReactNode;
  redirectTo?: string;
}

/**
 * Client-side route guard for protected pages like /dashboard.
 *
 * Server-side enforcement still lives in /api/auth/verify; this guard is
 * responsible for UX (loading state, redirect, ejecting non-UW users).
 */
export default function AuthGuard({ children, redirectTo = "/login" }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAuth(async (u) => {
      if (!u) {
        setUser(null);
        setChecking(false);
        router.replace(redirectTo);
        return;
      }

      if (!isAllowedEmail(u.email)) {
        await signOutCurrentUser();
        setUser(null);
        setChecking(false);
        router.replace(redirectTo);
        return;
      }

      // Run professor eligibility check on page load so restriction/log state is
      // refreshed whenever a signed-in user lands on a protected page.
      void canUserWriteReviews(u.email)
        .then((canWrite) => {
          console.log("[AuthGuard] Professor status check complete", {
            email: u.email,
            canWriteReviews: canWrite,
          });
        })
        .catch((err) => {
          console.error("[AuthGuard] Professor status check failed", {
            email: u.email,
            error: err,
          });
        });

      setUser(u);
      setChecking(false);
    });

    return () => unsub();
  }, [redirectTo, router]);

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Spinner />
          <span>Checking your UW credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children(user)}</>;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-husky-purple border-t-transparent"
    />
  );
}
