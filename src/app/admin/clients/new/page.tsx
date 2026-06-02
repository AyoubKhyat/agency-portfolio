"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";

type TeamMember = { id: string; fullName: string; role: string };

const STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];

const input =
  "w-full h-11 px-3.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const lbl = "block text-[13px] font-medium text-[#374151] mb-1.5";

export default function NewClientPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    industry: "",
    contractValue: "",
    acquisitionSource: "",
    status: "ACTIVE",
    accountManagerId: "",
  });

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setTeam(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contractValue: form.contractValue ? Number(form.contractValue) : 0,
          accountManagerId: form.accountManagerId || null,
        }),
      });
      if (res.ok) {
        const c = await res.json();
        router.push(`/admin/clients/${c.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed to create client.");
      }
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#111827] mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to clients
      </Link>

      <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">New client</h1>
      <p className="text-[14px] text-[#6B7280] mt-1 mb-6">
        Add a company to the agency&apos;s active accounts.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">Company</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Company name <span className="text-red-500">*</span></label>
              <input
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Luxury Copro SARL"
                required
                className={input}
                autoFocus
              />
            </div>
            <div>
              <label className={lbl}>Industry</label>
              <input
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                placeholder="Real estate"
                className={input}
              />
            </div>
            <div>
              <label className={lbl}>Website</label>
              <input
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://luxurycopro.com"
                className={input}
              />
            </div>
          </div>
        </section>

        <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Contact person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => update("contactPerson", e.target.value)}
                placeholder="Sarah Bennani"
                className={input}
              />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="sarah@luxurycopro.com"
                className={input}
              />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+212 6 ..."
                className={input}
              />
            </div>
            <div>
              <label className={lbl}>WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => update("whatsapp", e.target.value)}
                placeholder="wa.me/2126..."
                className={input}
              />
            </div>
          </div>
        </section>

        <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Contract value (MAD)</label>
              <input
                type="number"
                min={0}
                value={form.contractValue}
                onChange={(e) => update("contractValue", e.target.value)}
                placeholder="0"
                className={input}
              />
            </div>
            <div>
              <label className={lbl}>Acquisition source</label>
              <input
                value={form.acquisitionSource}
                onChange={(e) => update("acquisitionSource", e.target.value)}
                placeholder="Instagram, Referral, Cold WhatsApp..."
                className={input}
              />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className={input}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Account manager</label>
              <select
                value={form.accountManagerId}
                onChange={(e) => update("accountManagerId", e.target.value)}
                className={input}
              >
                <option value="">Unassigned</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-5 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[14px] font-semibold disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Creating..." : "Create client"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/clients")}
            className="h-11 px-5 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-[14px] font-medium hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
