"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, ExternalLink,
  Globe, AtSign, Mail, Phone, MapPin, Tag,
  Sparkles, Target, Building2, AlertTriangle, Search, Lock,
  MessageSquare, Clock, StickyNote, FileText, Calendar, FileSignature,
  HelpCircle, TrendingUp, Wand2, Download, UserCheck,
  Mail as MailIcon, RefreshCw, Copy, Check, Eye, Save, Loader2, X,
} from "lucide-react";
import { SEGMENT_TOKENS } from "@/lib/prospect-segments";
import { cn } from "@/lib/utils";
import type {
  LeadWorkspace, WorkspaceContactField, WorkspacePriority, WorkspaceStage, WorkspaceSource, ProjectSize,
} from "@/lib/workspace/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: LeadWorkspace }
  | { kind: "notfound" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

const CONTACT_ICONS: Record<string, typeof Globe> = {
  Website: Globe, Instagram: AtSign, Email: Mail, Phone: Phone,
};

const PRIORITY_TOKENS: Record<WorkspacePriority, string> = {
  HIGH: "bg-orange-50 text-orange-700 border-orange-100",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-100",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

const STAGE_CONFIG: Record<WorkspaceStage, { label: string; dot: string; pill: string }> = {
  DISCOVERY: { label: "Discovery", dot: "bg-purple-500", pill: "bg-purple-50 text-purple-700 border-purple-100" },
  QUALIFIED: { label: "Qualified", dot: "bg-blue-500", pill: "bg-blue-50 text-blue-700 border-blue-100" },
  CONTACTED: { label: "Contacted", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 border-amber-100" },
  MEETING: { label: "Meeting", dot: "bg-cyan-500", pill: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  PROPOSAL: { label: "Proposal", dot: "bg-indigo-500", pill: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  CLIENT: { label: "Client", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-100" },
};

const SIZES: ProjectSize[] = ["Small", "Medium", "Large", "Enterprise"];

/** Center modules — live ones render content, reserved ones hold their place.
 *  Adding a future module = one more entry here + its card. Never a redesign. */
const MODULES = [
  { id: "ai-research", label: "AI Research", icon: Sparkles, live: true },
  { id: "opportunity", label: "Opportunity", icon: Target, live: true },
  { id: "outreach", label: "Outreach", icon: MessageSquare, live: true },
  { id: "timeline", label: "Timeline", icon: Clock, live: false },
  { id: "proposal", label: "Proposal", icon: FileText, live: false },
  { id: "meetings", label: "Meetings", icon: Calendar, live: false },
  { id: "notes", label: "Notes", icon: StickyNote, live: false },
  { id: "contracts", label: "Contracts", icon: FileSignature, live: false },
] as const;

const QUICK_ACTIONS = [
  { label: "Generate Outreach", icon: Wand2 },
  { label: "Open Proposal", icon: FileText },
  { label: "Book Meeting", icon: Calendar },
  { label: "Import", icon: Download },
  { label: "Convert to Client", icon: UserCheck },
  { label: "Follow Up", icon: Clock },
] as const;

export function WorkspaceView({ endpoint }: { endpoint: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoint);
        if (cancelled) return;
        if (res.status === 401) { router.push("/admin/login"); return; }
        if (res.status === 404) { setState({ kind: "notfound" }); return; }
        if (res.status === 503) { setState({ kind: "unavailable" }); return; }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setState({ kind: "error", message: d.error || `Request failed (${res.status})` });
          return;
        }
        const data: LeadWorkspace = await res.json();
        setState({ kind: "ready", data });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      }
    })();
    return () => { cancelled = true; };
  }, [endpoint, router]);

  if (state.kind === "loading") return <WorkspaceSkeleton />;
  if (state.kind === "notfound") return <EmptyState icon={Search} title="Company not found" hint="This dossier may have been removed, or the link is out of date." />;
  if (state.kind === "unavailable") return <EmptyState icon={AlertTriangle} title="Database unavailable" hint="The workspace can't load data right now. Check the database connection and try again." />;
  if (state.kind === "error") return <EmptyState icon={AlertTriangle} title="Couldn't open workspace" hint={state.message} />;

  return <Workspace data={state.data} />;
}

/* ─────────────────────────── Shell ─────────────────────────── */

function Workspace({ data }: { data: LeadWorkspace }) {
  const domain = hostFromContacts(data.contacts);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-6xl mx-auto"
    >
      <Breadcrumbs data={data} />
      <CompanyHeader data={data} domain={domain} />
      <ContinuityBanner data={data} />

      {/* Modular center + persistent identity rail */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Center — only modules that exist today, plus one Future Modules section */}
        <div className="space-y-6 min-w-0">
          <AiResearchModule data={data} />
          <OpportunityModule data={data} />
          <OutreachModule source={data.source} id={data.id} />
          <FutureModulesSection />
        </div>

        {/* Persistent right rail — the company identity almost never changes */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <IdentityCard data={data} />
          <QuickActionsCard />
          <ModuleIndex />
        </aside>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Breadcrumbs + header ─────────────────────────── */

function Breadcrumbs({ data }: { data: LeadWorkspace }) {
  const section = data.source === "discovery"
    ? { label: "Discovery", href: "/admin/discovery" }
    : { label: "Relationships", href: "/admin/prospecting" };
  return (
    <nav className="flex items-center gap-1.5 text-[12.5px] text-[var(--os-text-dim)] mb-6 flex-wrap">
      <Link href="/admin" className="hover:text-[var(--os-text)] transition-colors">Sales</Link>
      <ChevronRight className="w-3 h-3 opacity-50" />
      <Link href={section.href} className="hover:text-[var(--os-text)] transition-colors">{section.label}</Link>
      <ChevronRight className="w-3 h-3 opacity-50" />
      <span>Workspace</span>
      <ChevronRight className="w-3 h-3 opacity-50" />
      <span className="text-[var(--os-text)] font-medium truncate max-w-[220px]">{data.name}</span>
    </nav>
  );
}

function CompanyHeader({ data, domain }: { data: LeadWorkspace; domain: string | null }) {
  const location = [data.city, data.country].filter(Boolean).join(", ");
  const stage = STAGE_CONFIG[data.stage];
  const seg = SEGMENT_TOKENS[data.segment];
  return (
    <header className="flex items-start gap-5">
      <CompanyMark name={data.name} domain={domain} />
      <div className="min-w-0 pt-0.5">
        <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border", stage.pill)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", stage.dot)} />
            {stage.label}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-[var(--os-border)] bg-[var(--os-surface)] text-[var(--os-text-muted)]">
            {data.source === "discovery"
              ? <><Sparkles className="w-3 h-3 text-[var(--os-purple)]" /> Discovery</>
              : <><Building2 className="w-3 h-3 text-[var(--os-text-dim)]" /> Relationship</>}
          </span>
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border", seg.chipBg, seg.chipText, seg.chipBorder)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", seg.dot)} />
            {data.segmentLabel}
          </span>
        </div>
        <h1 className="font-serif text-[38px] sm:text-[46px] leading-[1.02] tracking-[-0.01em] text-[var(--os-text)]">
          {data.name}
        </h1>
        <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[13px] text-[var(--os-text-muted)]">
          {domain && (
            <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--os-purple)] transition-colors">
              <Globe className="w-3.5 h-3.5 opacity-70" />{domain}
            </a>
          )}
          <span className="inline-flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 opacity-70" />{data.sector}</span>
          {location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 opacity-70" />{location}</span>}
        </div>
      </div>
    </header>
  );
}

function CompanyMark({ name, domain }: { name: string; domain: string | null }) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const showFavicon = Boolean(domain) && !failed;
  return (
    <div className="relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden border border-[var(--os-border)] shadow-sm flex items-center justify-center bg-gradient-to-br from-[var(--os-surface)] to-[var(--os-surface-2)]">
      {showFavicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt="" width={36} height={36} className="w-9 h-9 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-serif text-[26px] text-[var(--os-text)]">{letter}</span>
      )}
    </div>
  );
}

/* ─────────────────────────── Continuity ─────────────────────────── */

function ContinuityBanner({ data }: { data: LeadWorkspace }) {
  if (data.source === "discovery" && data.imported) {
    return (
      <div className="mt-6 rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50/70 to-fuchsia-50/40 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2 text-[13px] text-purple-900 flex-wrap">
            <span className="font-semibold">Discovery</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold">Imported into Relationships</span>
            {data.imported.importedByName && <span className="text-purple-700/70">· by {data.imported.importedByName}</span>}
          </div>
          <Link href={`/admin/workspace/prospect/${data.imported.prospectId}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold text-white bg-gradient-to-r from-[#8B00FF] to-[#C026D3] shadow-sm hover:shadow-md transition-all shrink-0">
            Continue in Relationship Workspace <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }
  if (data.source === "prospect" && data.origin) {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface-2)] px-5 py-3">
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--os-text-muted)] flex-wrap">
          <Sparkles className="w-3.5 h-3.5 text-[var(--os-purple)]" />
          <span>This company entered through</span>
          <Link href={`/admin/workspace/discovery/${data.origin.discoveryResultId}`}
            className="font-semibold text-[var(--os-purple)] hover:opacity-80 inline-flex items-center gap-1">
            AI Discovery <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }
  return null;
}

/* ─────────────────────────── Module shell ─────────────────────────── */

function ModuleShell({
  id, icon: Icon, iconClass, title, subtitle, children,
}: {
  id: string; icon: typeof Globe; iconClass: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
      <div className="flex items-center gap-3 px-7 sm:px-8 pt-7 pb-5">
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-xl border shrink-0", iconClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--os-text)]">{title}</h2>
          <p className="text-[12px] text-[var(--os-text-dim)]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const FUTURE_MODULES = [
  { icon: Clock, title: "Timeline", line: "One continuous history of every touch." },
  { icon: FileText, title: "Proposal", line: "Build, version, and track proposals." },
  { icon: Calendar, title: "Meetings", line: "Calls and meetings with this company." },
  { icon: StickyNote, title: "Notes", line: "Internal team notes with @mentions." },
  { icon: FileSignature, title: "Contracts", line: "Signed agreements and their status." },
] as const;

function FutureModulesSection() {
  return (
    <section id="future-modules" className="scroll-mt-6 rounded-3xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-7 sm:px-8 pt-6 pb-5 border-b border-[var(--os-border)]">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--os-text)]">Future Modules</h2>
          <p className="text-[12px] text-[var(--os-text-dim)]">Arriving in the next phases — each becomes its own module here.</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--os-text-dim)] px-2.5 py-1 rounded-full border border-[var(--os-border)] bg-[var(--os-surface-2)]">
          <Lock className="w-3 h-3" /> Coming soon
        </span>
      </div>
      <div className="p-4 grid gap-3 sm:grid-cols-2">
        {FUTURE_MODULES.map((m) => (
          <div key={m.title} className="flex items-start gap-3 rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface-2)]/40 px-4 py-3.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--os-surface)] border border-[var(--os-border)] shrink-0">
              <m.icon className="w-3.5 h-3.5 text-[var(--os-text-dim)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-[var(--os-text-muted)]">{m.title}</h3>
                <Lock className="w-2.5 h-2.5 text-[var(--os-text-dim)] opacity-60" />
              </div>
              <p className="text-[11.5px] text-[var(--os-text-dim)] mt-0.5 leading-snug">{m.line}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <p className="text-[11px] text-[var(--os-text-dim)] text-center">Coming in next phases</p>
      </div>
    </section>
  );
}

/* ─────────────────────────── AI Research module ─────────────────────────── */

function AiResearchModule({ data }: { data: LeadWorkspace }) {
  const ai = data.aiResearch;
  return (
    <ModuleShell
      id="ai-research" icon={Sparkles}
      iconClass="bg-gradient-to-br from-purple-50 to-fuchsia-50 border-purple-100 text-purple-600"
      title="AI Research" subtitle="What our agent understands about this company"
    >
      {ai ? (
        <div className="px-7 sm:px-8 pb-8 space-y-7">
          <ResearchBlock index="01" question="Who are they?" body={ai.aiSummary} icon={HelpCircle} />
          <ResearchBlock index="02" question="What do they currently have?" body={ai.websiteSummary} icon={Globe} />
          <ResearchBlock index="03" question="What opportunity do we see?" body={ai.opportunityExplanation} icon={TrendingUp} />
          <SuggestedOffer body={ai.suggestedOffer} />
        </div>
      ) : (
        <div className="px-8 py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--os-surface-2)] border border-[var(--os-border)] mb-3">
            <Sparkles className="w-5 h-5 text-[var(--os-text-dim)] opacity-50" />
          </div>
          <p className="text-[14px] font-medium text-[var(--os-text)]">No AI research on record</p>
          <p className="text-[12.5px] text-[var(--os-text-muted)] mt-1.5 max-w-sm mx-auto leading-relaxed">
            This company was added manually. AI research is generated when a company enters through Discovery.
          </p>
        </div>
      )}
    </ModuleShell>
  );
}

function ResearchBlock({ index, question, body, icon: Icon }: { index: string; question: string; body: string; icon: typeof Globe }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 pt-0.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--os-surface-2)] border border-[var(--os-border)]">
          <Icon className="w-3.5 h-3.5 text-[var(--os-text-dim)]" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10.5px] text-[var(--os-text-dim)]">{index}</span>
          <h3 className="text-[13px] font-semibold text-[var(--os-text)]">{question}</h3>
        </div>
        {body
          ? <p className="text-[14.5px] leading-relaxed text-[var(--os-text-muted)]">{body}</p>
          : <p className="text-[13px] text-[var(--os-text-dim)] italic">Not available yet.</p>}
      </div>
    </div>
  );
}

function SuggestedOffer({ body }: { body: string }) {
  return (
    <div className="relative rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/80 via-white to-fuchsia-50/50 p-6 overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-purple-200/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2.5">
          <Wand2 className="w-4 h-4 text-purple-600" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-purple-700">What Ibda3 Digital should propose</h3>
        </div>
        {body
          ? <p className="text-[17px] leading-relaxed font-medium text-purple-950">{body}</p>
          : <p className="text-[14px] text-purple-900/60 italic">No suggested offer yet.</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────── Opportunity module ─────────────────────────── */

function OpportunityModule({ data }: { data: LeadWorkspace }) {
  const { opportunity: o, scores } = data;
  return (
    <ModuleShell
      id="opportunity" icon={Target}
      iconClass="bg-amber-50 border-amber-100 text-amber-600"
      title="Opportunity" subtitle="Our recommendation for this company"
    >
      <div className="px-7 sm:px-8 pb-8 space-y-6">
        <RecoRow label="Priority">
          <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[12.5px] font-semibold border", PRIORITY_TOKENS[o.priority])}>{o.priority}</span>
        </RecoRow>
        <RecoRow label="Estimated project size">
          <div className="inline-flex rounded-xl border border-[var(--os-border)] bg-[var(--os-surface-2)] p-1">
            {SIZES.map((s) => (
              <span key={s} className={cn(
                "px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors",
                s === o.budget.size ? "bg-[var(--os-surface)] text-[var(--os-text)] shadow-sm border border-[var(--os-border)]" : "text-[var(--os-text-dim)]",
              )}>{s}</span>
            ))}
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
            <span className="font-serif text-[24px] text-[var(--os-text)] tabular-nums leading-none">{o.budget.rangeLabel}</span>
            <span className="text-[11.5px] text-[var(--os-text-dim)]">{o.budget.basis}</span>
          </div>
        </RecoRow>
        <RecoRow label="Recommended service">
          <p className="text-[14.5px] leading-relaxed text-[var(--os-text-muted)]">{o.recommendedService}</p>
        </RecoRow>
        <RecoRow label="Why now?">
          <p className="text-[14.5px] leading-relaxed text-[var(--os-text-muted)]">{o.whyInteresting || whyNow(o.priority, scores.opportunityLabel)}</p>
        </RecoRow>
      </div>
    </ModuleShell>
  );
}

function RecoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[160px_minmax(0,1fr)] gap-2 sm:gap-5">
      <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--os-text-dim)] pt-1">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function whyNow(priority: WorkspacePriority, label: string | null): string {
  const sig = label ? ` (${label} signal)` : "";
  if (priority === "HIGH") return `Strong opportunity${sig} with a clear digital gap — a good moment to reach out now.`;
  if (priority === "MEDIUM") return `A solid opportunity worth pursuing — engage when it fits your pipeline.`;
  return `Lower urgency for now — keep warm and revisit as signals strengthen.`;
}

/* ─────────────────────────── Outreach module ─────────────────────────── */

type OutreachPhase = "loading" | "ready" | "unavailable" | "error";

function OutreachModule({ source, id }: { source: WorkspaceSource; id: string }) {
  const endpoint = `/api/admin/workspace/${source}/${id}/outreach`;

  const [phase, setPhase] = useState<OutreachPhase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [canPersist, setCanPersist] = useState(true);

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [waBody, setWaBody] = useState("");
  const [emailExists, setEmailExists] = useState(false);
  const [waExists, setWaExists] = useState(false);
  const [saved, setSaved] = useState({ emailSubject: "", emailBody: "", waBody: "" });

  const [busy, setBusy] = useState<null | "email" | "whatsapp" | "save">(null);
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoint);
        if (cancelled) return;
        if (res.status === 503) { setPhase("unavailable"); return; }
        if (!res.ok) { setErrMsg(`Failed to load (${res.status})`); setPhase("error"); return; }
        const d = await res.json();
        setEmailSubject(d.email.subject); setEmailBody(d.email.body);
        setWaBody(d.whatsapp.body);
        setEmailExists(d.email.exists); setWaExists(d.whatsapp.exists);
        setCanPersist(d.canPersist);
        setSaved({ emailSubject: d.email.subject, emailBody: d.email.body, waBody: d.whatsapp.body });
        setPhase("ready");
      } catch (e) {
        if (!cancelled) { setErrMsg(e instanceof Error ? e.message : "Something went wrong"); setPhase("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [endpoint]);

  async function generate(ch: "email" | "whatsapp", regenerate: boolean) {
    setBusy(ch); setErrMsg("");
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: ch, regenerate }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Generation failed");
      setCanPersist(d.canPersist);
      if (ch === "email") {
        setEmailSubject(d.subject || ""); setEmailBody(d.body); setEmailExists(true);
        if (d.canPersist) setSaved((p) => ({ ...p, emailSubject: d.subject || "", emailBody: d.body }));
      } else {
        setWaBody(d.body); setWaExists(true);
        if (d.canPersist) setSaved((p) => ({ ...p, waBody: d.body }));
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save"); setErrMsg("");
    try {
      const payload = channel === "email"
        ? { channel, subject: emailSubject, body: emailBody }
        : { channel, body: waBody };
      const res = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSaved((p) => channel === "email"
        ? { ...p, emailSubject, emailBody }
        : { ...p, waBody });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  function copyActive() {
    const text = channel === "email"
      ? (emailSubject ? `${emailSubject}\n\n${emailBody}` : emailBody)
      : waBody;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  }

  const exists = channel === "email" ? emailExists : waExists;
  const hasContent = channel === "email" ? Boolean(emailSubject || emailBody) : Boolean(waBody);
  const dirty = channel === "email"
    ? emailSubject !== saved.emailSubject || emailBody !== saved.emailBody
    : waBody !== saved.waBody;

  return (
    <ModuleShell
      id="outreach" icon={MessageSquare}
      iconClass="bg-sky-50 border-sky-100 text-sky-600"
      title="Outreach" subtitle="Prepare the first message to this company"
    >
      {phase === "loading" && (
        <div className="px-7 sm:px-8 pb-8 flex items-center gap-2 text-[13px] text-[var(--os-text-dim)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading drafts…
        </div>
      )}

      {phase === "unavailable" && (
        <div className="px-7 sm:px-8 pb-8 text-[13px] text-[var(--os-text-muted)]">
          Drafts are unavailable — the database can’t be reached right now.
        </div>
      )}

      {phase === "error" && (
        <div className="px-7 sm:px-8 pb-8 text-[13px] text-red-600">{errMsg || "Couldn’t load outreach."}</div>
      )}

      {phase === "ready" && (
        <div className="px-7 sm:px-8 pb-8">
          {/* Channel toggle */}
          <div className="inline-flex rounded-xl border border-[var(--os-border)] bg-[var(--os-surface-2)] p-1 mb-5">
            <ChannelTab icon={MailIcon} label="Email" active={channel === "email"} onClick={() => setChannel("email")} />
            <ChannelTab icon={MessageSquare} label="WhatsApp" active={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} />
          </div>

          {!hasContent && !exists ? (
            <EmptyDraft
              channel={channel}
              busy={busy === channel}
              onGenerate={() => generate(channel, false)}
            />
          ) : (
            <div className="space-y-4">
              {channel === "email" && (
                <div>
                  <FieldLabel>Subject</FieldLabel>
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Email subject…"
                    className="w-full rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)] px-3.5 py-2.5 text-[14px] text-[var(--os-text)] outline-none focus:border-[var(--os-purple)] transition-colors"
                  />
                </div>
              )}
              <div>
                <FieldLabel>{channel === "email" ? "Body" : "Message"}</FieldLabel>
                <textarea
                  value={channel === "email" ? emailBody : waBody}
                  onChange={(e) => (channel === "email" ? setEmailBody(e.target.value) : setWaBody(e.target.value))}
                  rows={channel === "email" ? 9 : 6}
                  placeholder="Write or generate a draft…"
                  className="w-full rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--os-text)] outline-none focus:border-[var(--os-purple)] transition-colors resize-y"
                />
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2">
                <OutreachButton
                  onClick={() => generate(channel, true)}
                  busy={busy === channel}
                  icon={RefreshCw}
                  label="Regenerate"
                />
                <OutreachButton onClick={copyActive} icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} />
                <OutreachButton onClick={() => setPreview(true)} icon={Eye} label="Preview" />
                <div className="flex-1" />
                <button
                  onClick={save}
                  disabled={!canPersist || !dirty || busy === "save"}
                  title={!canPersist ? "This lead has no Discovery origin — drafts can’t be saved." : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold transition-all",
                    !canPersist || !dirty
                      ? "bg-[var(--os-surface-2)] text-[var(--os-text-dim)] cursor-not-allowed border border-[var(--os-border)]"
                      : "text-white bg-gradient-to-r from-[#8B00FF] to-[#C026D3] shadow-sm hover:shadow-md",
                  )}
                >
                  {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {justSaved ? "Saved" : "Save Draft"}
                </button>
              </div>

              {!canPersist && (
                <p className="text-[11.5px] text-[var(--os-text-dim)]">
                  This lead has no Discovery origin, so drafts can be generated and copied but not saved.
                </p>
              )}
              {errMsg && <p className="text-[12px] text-red-600">{errMsg}</p>}
            </div>
          )}
        </div>
      )}

      {preview && (
        <OutreachPreview
          channel={channel}
          subject={emailSubject}
          body={channel === "email" ? emailBody : waBody}
          onClose={() => setPreview(false)}
        />
      )}
    </ModuleShell>
  );
}

function ChannelTab({ icon: Icon, label, active, onClick }: { icon: typeof Globe; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors",
        active ? "bg-[var(--os-surface)] text-[var(--os-text)] shadow-sm border border-[var(--os-border)]" : "text-[var(--os-text-dim)]",
      )}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--os-text-dim)] mb-1.5">{children}</div>;
}

function EmptyDraft({ channel, busy, onGenerate }: { channel: "email" | "whatsapp"; busy: boolean; onGenerate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--os-border)] bg-[var(--os-surface-2)]/40 px-6 py-10 text-center">
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--os-surface)] border border-[var(--os-border)] mb-3">
        {channel === "email" ? <MailIcon className="w-5 h-5 text-[var(--os-text-dim)]" /> : <MessageSquare className="w-5 h-5 text-[var(--os-text-dim)]" />}
      </div>
      <p className="text-[13.5px] font-medium text-[var(--os-text)]">No {channel === "email" ? "email" : "WhatsApp"} draft yet</p>
      <p className="text-[12.5px] text-[var(--os-text-muted)] mt-1 max-w-xs mx-auto leading-relaxed">
        Generate a first draft from this company’s AI research and suggested offer.
      </p>
      <button
        onClick={onGenerate}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all",
          busy ? "bg-purple-100 text-purple-500 cursor-wait" : "text-white bg-gradient-to-r from-[#8B00FF] to-[#C026D3] shadow-sm hover:shadow-md",
        )}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
        {busy ? "Generating…" : "Generate draft"}
      </button>
    </div>
  );
}

function OutreachButton({ onClick, icon: Icon, label, busy }: { onClick: () => void; icon: typeof Globe; label: string; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border transition-colors",
        busy
          ? "bg-[var(--os-surface-2)] text-[var(--os-text-dim)] border-[var(--os-border)] cursor-wait"
          : "bg-[var(--os-surface)] text-[var(--os-text-muted)] border-[var(--os-border)] hover:border-[var(--os-purple)] hover:text-[var(--os-purple)]",
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

function OutreachPreview({ channel, subject, body, onClose }: { channel: "email" | "whatsapp"; subject: string; body: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-[var(--os-surface)] border border-[var(--os-border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--os-border)]">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--os-text)]">
            {channel === "email" ? <MailIcon className="w-4 h-4 text-sky-600" /> : <MessageSquare className="w-4 h-4 text-emerald-600" />}
            {channel === "email" ? "Email preview" : "WhatsApp preview"}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--os-text-dim)] hover:bg-[var(--os-surface-2)] transition-colors" aria-label="Close preview">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-3">
          {channel === "email" && subject && (
            <div className="rounded-lg border border-[var(--os-border)] bg-[var(--os-surface-2)] px-3 py-2 text-[13.5px] font-medium text-[var(--os-text)]">
              {subject}
            </div>
          )}
          {body
            ? <p className="text-[13.5px] leading-relaxed text-[var(--os-text-muted)] whitespace-pre-wrap">{body}</p>
            : <p className="text-[13px] italic text-[var(--os-text-dim)]">Nothing to preview yet.</p>}
        </div>
        <div className="px-5 py-3 border-t border-[var(--os-border)] text-[11px] text-[var(--os-text-dim)]">
          Preview only — nothing is sent from here.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Persistent rail ─────────────────────────── */

function IdentityCard({ data }: { data: LeadWorkspace }) {
  return (
    <section className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--os-border)]">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--os-text-dim)]">Company Details</h2>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 divide-x divide-[var(--os-border)] border-b border-[var(--os-border)]">
        <ScoreCell label="Opportunity" value={data.scores.opportunity} tag={data.scores.opportunityLabel} />
        <ScoreCell label="Confidence" value={data.scores.confidence} />
      </div>

      {/* Contacts — MISSING/INVALID hidden; only VERIFIED is clickable */}
      <div className="p-2">
        {(() => {
          const visible = data.contacts.filter((c) => c.status !== "MISSING" && c.status !== "INVALID");
          if (visible.length === 0) {
            return <div className="px-3 py-3 text-[12px] text-[var(--os-text-dim)]">No contact details yet.</div>;
          }
          return visible.map((c) => <ContactRow key={c.label} contact={c} />);
        })()}
      </div>
    </section>
  );
}

function ScoreCell({ label, value, tag }: { label: string; value: number | null; tag?: string | null }) {
  return (
    <div className="px-4 py-3.5 text-center">
      <div className="font-serif text-[28px] leading-none text-[var(--os-text)] tabular-nums">{value == null ? "—" : value}</div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--os-text-dim)] font-medium">{label}</div>
      {tag && <div className="mt-1 text-[9px] font-bold tracking-wider text-[var(--os-text-dim)]">{tag}</div>}
    </div>
  );
}

function ContactRow({ contact: c }: { contact: WorkspaceContactField }) {
  const Icon = CONTACT_ICONS[c.label] ?? Globe;
  const external = c.label !== "Phone" && c.label !== "Email";
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--os-surface-2)] transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--os-surface-2)] border border-[var(--os-border)] shrink-0">
        <Icon className="w-3.5 h-3.5 text-[var(--os-text-dim)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-wide text-[var(--os-text-dim)] font-medium">{c.label}</div>
        {c.status === "VERIFIED" && c.href ? (
          <a href={c.href} target={external ? "_blank" : undefined} rel="noreferrer"
            className="text-[13px] text-[var(--os-purple)] hover:opacity-80 transition-opacity inline-flex items-center gap-1 max-w-full">
            <span className="truncate">{c.value}</span>
            {external ? <ExternalLink className="w-3 h-3 shrink-0 opacity-50" /> : <Check className="w-3 h-3 shrink-0 text-emerald-500" />}
          </a>
        ) : c.status === "UNAVAILABLE" ? (
          <div className="text-[13px] text-[var(--os-text-dim)] line-through">{c.value || "Unavailable"}</div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] text-[var(--os-text-muted)] truncate">{c.value || "—"}</span>
            <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--os-surface-2)] border border-[var(--os-border)] text-[var(--os-text-dim)]">Unverified</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionsCard() {
  return (
    <section className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--os-text-dim)]">Quick actions</h2>
        <span className="text-[10px] text-[var(--os-text-dim)] inline-flex items-center gap-1"><Lock className="w-3 h-3" />Soon</span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1.5">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} type="button" disabled
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-[var(--os-border)] bg-[var(--os-surface-2)]/50 text-[var(--os-text-dim)] opacity-70 cursor-not-allowed text-left"
            title="Available in a later phase">
            <a.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11.5px] font-medium leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ModuleIndex() {
  return (
    <section className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-1.5">
      <div className="px-3 pt-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--os-text-dim)]">Modules</div>
      {MODULES.map((m) => (
        <a key={m.id} href={m.live ? `#${m.id}` : "#future-modules"}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors hover:bg-[var(--os-surface-2)]",
            m.live ? "text-[var(--os-text-muted)]" : "text-[var(--os-text-dim)]",
          )}>
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--os-surface-2)] border border-[var(--os-border)] shrink-0">
            <m.icon className="w-3 h-3" />
          </div>
          <span className="text-[12.5px] font-medium flex-1">{m.label}</span>
          {!m.live && <Lock className="w-3 h-3 opacity-50" />}
        </a>
      ))}
    </section>
  );
}

/* ─────────────────────────── Helpers + states ─────────────────────────── */

function hostFromContacts(contacts: WorkspaceContactField[]): string | null {
  const site = contacts.find((c) => c.label === "Website");
  if (!site || !site.value) return null;
  try {
    const u = new URL(site.value.startsWith("http") ? site.value : `https://${site.value}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return site.value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

function WorkspaceSkeleton() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-3.5 w-64 bg-[var(--os-surface-2)] rounded mb-6" />
      <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[var(--os-surface-2)]" />
        <div className="flex-1 pt-1">
          <div className="h-4 w-40 bg-[var(--os-surface-2)] rounded mb-3" />
          <div className="h-10 w-2/3 bg-[var(--os-surface-2)] rounded mb-3" />
          <div className="h-3.5 w-1/2 bg-[var(--os-surface-2)] rounded" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="h-80 bg-[var(--os-surface-2)] rounded-3xl" />
          <div className="h-64 bg-[var(--os-surface-2)] rounded-3xl" />
        </div>
        <div className="space-y-4">
          <div className="h-72 bg-[var(--os-surface-2)] rounded-2xl" />
          <div className="h-40 bg-[var(--os-surface-2)] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Globe; title: string; hint: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-24">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--os-surface-2)] border border-[var(--os-border)] mb-4">
        <Icon className="w-6 h-6 text-[var(--os-text-dim)]" />
      </div>
      <h1 className="text-[17px] font-semibold text-[var(--os-text)]">{title}</h1>
      <p className="text-[13px] text-[var(--os-text-muted)] mt-1.5">{hint}</p>
      <Link href="/admin/discovery" className="inline-flex items-center gap-1.5 mt-6 text-[13px] font-medium text-[var(--os-purple)] hover:opacity-80">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Discovery
      </Link>
    </div>
  );
}
