"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { MORE_GROUPS } from "@/lib/admin-nav";

export default function MorePage() {
  const router = useRouter();

  // Same rule as the other admin pages: signed-out visitors go to the login page.
  useEffect(() => {
    fetch("/api/admin/me").then((r) => { if (r.status === 401) router.push("/admin/login"); }).catch(() => {});
  }, [router]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="More" />
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        {MORE_GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--os-text-dim)] px-3 mb-1">{group.label}</h2>
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] text-[var(--os-text)] hover:bg-[var(--os-surface-2)] transition-colors"
              >
                {link.label}
                <ChevronRight className="w-4 h-4 text-[var(--os-text-dim)]" />
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
