// components/ProfessorSearchModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

interface Professor {
    id: string;
    name: string;
    department: string;
    campus: string[];
    ias_review_id?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** Where selecting a professor navigates. "review" → write a review, "ias" → IAS ratings. */
    mode?: "review" | "ias";
}

const MODE_COPY = {
    review: { heading: "Select a professor to review", path: "review" },
    ias: { heading: "Select a professor to view IAS ratings", path: "ias" },
} as const;

export default function ProfessorSearchModal({ open, onClose, mode = "review" }: Props) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [professors, setProfessors] = useState<Professor[]>([]);
    const [loading, setLoading] = useState(false);

    // Focus input when modal opens
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setSearchQuery("");
        }
    }, [open]);

    // Fetch professors on first open
    useEffect(() => {
        if (!open || professors.length > 0) return;
        (async () => {
            setLoading(true);
            try {
                const snap = await getDocs(
                    query(collection(db, "professors"), orderBy("name"))
                );
                setProfessors(
                    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Professor, "id">) }))
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [open, professors.length]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const filtered = professors.filter((p) => {
        // In IAS mode, only surface professors that actually have IAS data linked.
        if (mode === "ias" && !p.ias_review_id) return false;
        const q = searchQuery.toLowerCase();
        return (
            p.name.toLowerCase().includes(q) ||
            p.department?.toLowerCase().includes(q)
        );
    });

    function handleSelect(prof: Professor) {
        onClose();
        router.push(`/professors/${prof.id}/${MODE_COPY[mode].path}`);
    }

    if (!open) return null;

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Modal */}
            <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {MODE_COPY[mode].heading}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Search input */}
                <div className="border-b border-gray-100 dark:border-gray-700 px-5 py-3">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search by name or department…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-md border border-gray-200 dark:border-gray-700 py-2 pl-9 pr-3 text-sm focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                        />
                    </div>
                </div>

                {/* Results list */}
                <ul className="max-h-72 overflow-y-auto py-1">
                    {loading ? (
                        <li className="flex items-center justify-center py-8">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-husky-purple border-t-transparent" />
                        </li>
                    ) : filtered.length === 0 ? (
                        <li className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                            {searchQuery ? `No professors found for "${searchQuery}"` : "No professors yet."}
                        </li>
                    ) : (
                        filtered.map((prof) => (
                            <li key={prof.id}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(prof)}
                                    className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-husky-light dark:hover:bg-husky-purple/20 focus:bg-husky-light dark:focus:bg-husky-purple/20 focus:outline-none"
                                >
                                    {/* Avatar initial */}
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-husky-purple/10 dark:bg-husky-purple/20 text-xs font-semibold text-husky-purple dark:text-husky-purpleLight">
                                        {prof.name.charAt(0)}
                                    </span>
                                    <span>
                                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{prof.name}</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                                            {prof.department}
                                            {prof.campus?.length > 0 && ` · ${prof.campus.join(", ")}`}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>

                {/* Footer hint */}
                <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Can't find your professor?{" "}
                        <a href="/search" className="text-husky-purple dark:text-husky-purpleLight hover:underline">
                            Browse all professors →
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
