// app/search/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import AuthGuard from "@/components/AuthGuard";
import type { User } from "firebase/auth";

type Professor = {
  id: string;
  name: string;
  department: string;
  campus: string[];           // string[] — multi-campus support
  courses_taught: string[];
  overall_rating: number;
  ratings_count: number;
  tags: string[];
};

const CAMPUSES = ["All Campuses", "UW Bothell", "UW Seattle", "UW Tacoma"];
const RATING_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "4+ ★", value: 4 },
  { label: "3+ ★", value: 3 },
  { label: "2+ ★", value: 2 },
];

export default function SearchPage() {
  return (
    <AuthGuard>
      {(user) => <SearchView user={user} />}
    </AuthGuard>
  );
}

function SearchView({ user: _user }: { user: User }) {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campus, setCampus] = useState("All Campuses");
  const [minRating, setMinRating] = useState(0);
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, "professors"), orderBy("name"));
        const snap = await getDocs(q);
        setProfessors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Professor)));
      } catch (err) {
        console.error("Failed to load professors:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return professors.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.courses_taught.some((c) => c.toLowerCase().includes(q));

      // campus is now string[] — use .includes()
      const matchesCampus =
        campus === "All Campuses" || p.campus.includes(campus);

      const matchesRating = p.overall_rating >= minRating;
      const matchesCourse =
        !courseFilter ||
        p.courses_taught.some((c) =>
          c.toLowerCase().includes(courseFilter.toLowerCase())
        );

      return matchesSearch && matchesCampus && matchesRating && matchesCourse;
    });
  }, [professors, search, campus, minRating, courseFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-husky-purple transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-husky-purple">Browse Professors</h1>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm space-y-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, course code, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Campus</label>
            <div className="flex gap-1.5">
              {CAMPUSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCampus(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${campus === c
                    ? "bg-husky-purple text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Min Rating</label>
            <div className="flex gap-1.5">
              {RATING_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setMinRating(r.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${minRating === r.value
                    ? "bg-husky-purple text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Course Code</label>
            <input
              type="text"
              placeholder="e.g. CSS 342"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple w-32"
            />
          </div>
        </div>
      </div>

      {!loading && (
        <p className="text-sm text-gray-500">
          {filtered.length === 0
            ? "No professors match your filters."
            : `${filtered.length} professor${filtered.length !== 1 ? "s" : ""} found`}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((prof) => (
            <ProfessorCard key={prof.id} professor={prof} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfessorCard({ professor: p }: { professor: Professor }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/professors/${p.id}`)}
      className="w-full rounded-lg border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-husky-purple hover:shadow-md focus:outline-none focus:ring-2 focus:ring-husky-purple"
    >
      <div className="flex items-center gap-4">
        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{p.name}</h3>
            <span className="text-xs text-husky-metallic">{p.campus.join(" / ")}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{p.department}</p>

          {/* Course pills */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.courses_taught.slice(0, 5).map((c) => (
              <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {c}
              </span>
            ))}
            {p.courses_taught.length > 5 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                +{p.courses_taught.length - 5} more
              </span>
            )}
          </div>
        </div>

        {/* Rating — right side */}
        <div className="flex shrink-0 flex-col items-center gap-1 pl-4 border-l border-gray-100">
          <div className="flex items-center gap-1">
            <StarIcon className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="text-lg font-bold text-husky-purple">
              {p.overall_rating > 0 ? p.overall_rating.toFixed(1) : "—"}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {p.ratings_count > 0
              ? `${p.ratings_count} review${p.ratings_count !== 1 ? "s" : ""}`
              : "No reviews"}
          </span>
        </div>
      </div>
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span aria-hidden="true" className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-husky-purple border-t-transparent" />
  );
}
