"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SECTORS = [
  "Dentiste", "Salon Beauté", "Salle de Sport", "Avocat",
  "Architecte/Décorateur", "Immobilier", "Restaurant/Café",
  "Patisserie", "Boulangerie", "Riad/Maison d'hôtes",
  "Photographe/Vidéaste", "Traiteur",
];

const PRIORITIES = [
  { value: 1, label: "1 — Instagram sans site" },
  { value: 2, label: "2 — Sans site" },
  { value: 3, label: "3 — A un site" },
];

type ProspectData = {
  id?: string;
  name: string;
  phone: string;
  sector: string;
  neighborhood: string;
  instagram: string;
  hasWebsite: boolean;
  priority: number;
  status: string;
};

const lbl = "block text-xs text-gray-400 uppercase tracking-wider mb-1.5";
const input = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500 transition-colors";

export default function ProspectForm({ mode, initial }: { mode: "create" | "edit"; initial?: ProspectData }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [sector, setSector] = useState(initial?.sector ?? SECTORS[0]);
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [hasWebsite, setHasWebsite] = useState(initial?.hasWebsite ?? false);
  const [priority, setPriority] = useState(initial?.priority ?? 2);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setSaving(true);
    setError("");

    const body = { name, phone, sector, neighborhood, instagram, hasWebsite, priority };
    const url = mode === "create" ? "/api/admin/prospecting" : `/api/admin/prospecting/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/admin/prospecting");
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
    }
    setSaving(false);
  }

  const whatsappPreview = phone ? `wa.me/${phone.replace(/\D/g, "")}` : "";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Dr Hind Nadim" />
        </div>
        <div>
          <label className={lbl}>Phone *</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} placeholder="0606239619" />
          {whatsappPreview && <p className="text-xs text-gray-600 mt-1">{whatsappPreview}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Sector</label>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className={input}>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Quartier</label>
          <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={input} placeholder="Gueliz" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Instagram</label>
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} className={input} placeholder="@drhindnadim" />
        </div>
        <div>
          <label className={lbl}>Priority</label>
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={input}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={hasWebsite}
          onChange={(e) => setHasWebsite(e.target.checked)}
          className="w-4 h-4 rounded border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500"
        />
        <span className="text-sm text-gray-300">Has a website</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Prospect" : "Update Prospect"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/prospecting")}
          className="px-6 py-2.5 border border-white/10 hover:border-white/20 text-gray-300 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
