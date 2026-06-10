"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { DashboardTab } from "./_tabs/dashboard";
import { TemplatesTab } from "./_tabs/templates";
import { ScriptsTab } from "./_tabs/scripts";
import { SequencesTab } from "./_tabs/sequences";

const TABS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "templates", label: "Templates" },
  { value: "scripts", label: "Scripts" },
  { value: "sequences", label: "Sequences" },
];

export default function SalesPlaybookPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div>
      <PageHeader
        title="Sales Playbook"
        subtitle="Templates, sequences, scripts, and coaching to lift reply and conversion rates."
        actions={
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[#64748B]">
            <BookOpen className="w-3.5 h-3.5" />
            Tools for the sales team
          </span>
        }
      />

      <div className="mb-5">
        <FilterTabs items={TABS} active={tab} onChange={setTab} size="md" />
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "scripts" && <ScriptsTab />}
      {tab === "sequences" && <SequencesTab />}
    </div>
  );
}
