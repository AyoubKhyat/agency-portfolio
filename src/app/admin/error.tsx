"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 border border-[#8B00FF]/20">
          <svg
            className="h-8 w-8 text-[#8B00FF]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-[#0F172A] mb-2">
          Something went wrong
        </h2>

        {/* Description */}
        <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
          An unexpected error occurred in the admin panel. You can try again or
          go back to the dashboard.
        </p>

        {/* Error digest (dev hint) */}
        {error.digest && (
          <p className="text-xs text-[#94A3B8] mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8B00FF] to-[#C026D3] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition hover:shadow-lg hover:shadow-purple-500/30 focus:outline-none focus:ring-2 focus:ring-[#8B00FF] focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
              />
            </svg>
            Try Again
          </button>

          <a
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-medium text-[#475569] transition hover:bg-[#F8FAFC] hover:border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#8B00FF] focus:ring-offset-2"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
