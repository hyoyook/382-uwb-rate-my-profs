// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuth, signOutCurrentUser } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = subscribeToAuth((u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleSignOut() {
    await signOutCurrentUser();
    router.replace("/login");
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-husky-purple">
            Rate My Husky
          </span>
          <span className="rounded-full bg-husky-light px-2 py-0.5 text-xs font-medium text-husky-metallic">
            UW only
          </span>
        </Link>

        <ul className="flex items-center gap-6 text-sm">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    active
                      ? "font-medium text-husky-purple"
                      : "text-gray-600 hover:text-husky-purple"
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}

          <li>
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md bg-husky-purple px-3 py-1.5 text-sm text-white hover:bg-husky-purple/90 transition-colors"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-husky-purple px-3 py-1.5 text-white hover:bg-husky-purple/90 transition-colors"
              >
                Sign in
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}
