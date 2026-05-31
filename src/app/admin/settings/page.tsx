"use client";

import { PageHeader } from "@/components/admin/page-header";
import { GlassCard } from "@/components/admin/glass-card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Account and preferences" />
      <GlassCard padding="lg" className="max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-[#0F172A]">Ayoub Khyat</div>
            <div className="text-xs text-[#475569]">Admin</div>
          </div>
        </div>
        <p className="text-sm text-[#475569]">More settings coming soon.</p>
      </GlassCard>
    </div>
  );
}
