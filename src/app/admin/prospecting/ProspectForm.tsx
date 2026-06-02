"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, MapPin, Tag, MessageCircle } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import {
  AdminFormLayout, FormCard, FormGrid, FormGridMain, FormGridAside,
  Field, Input, Select, Toggle,
} from "@/components/admin/form";

const SECTORS = [
  "Dentiste", "Salon Beauté", "Salle de Sport", "Avocat",
  "Architecte/Décorateur", "Immobilier", "Restaurant/Café",
  "Patisserie", "Boulangerie", "Riad/Maison d'hôtes",
  "Photographe/Vidéaste", "Traiteur", "Spa/Hammam",
  "Coach Sportif", "Centre de Formation", "Garage Auto",
  "Décoration / Meubles", "Boutique Mode", "Bijouterie",
  "Agence de Voyage", "Clinique / Cabinet Médical",
  "Centre de Langues",
];

const PRIORITIES = [
  { value: 1, label: "P1 — Instagram, no website" },
  { value: 2, label: "P2 — No website" },
  { value: 3, label: "P3 — Has a website" },
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
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const markDirty = () => { if (!dirty) setDirty(true); };

  const nameInvalid = !name.trim() && !!error;
  const phoneInvalid = !phone.trim() && !!error;

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

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDirty(false);
        router.push("/admin/prospecting");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
      }
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    router.push("/admin/prospecting");
  }

  const whatsappPreview = phone ? `wa.me/${phone.replace(/\D/g, "")}` : "";
  const cleanInstagram = instagram.replace(/^@/, "");

  return (
    <AdminFormLayout
      title={mode === "create" ? "New prospect" : "Edit prospect"}
      subtitle={mode === "create" ? "Add a business to the outreach pipeline." : "Update prospect details."}
      backHref="/admin/prospecting"
      backLabel="Back to prospecting"
      primaryLabel={mode === "create" ? "Create prospect" : "Save changes"}
      primaryLoadingLabel="Saving..."
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      saving={saving}
      dirty={dirty}
      error={error}
    >
      <FormGrid layout="split-70-30">
        <FormGridMain>
          <FormCard
            title="Identity"
            subtitle="Who is this prospect and where are they based?"
            icon={<User className="w-4 h-4" />}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Business name" required error={nameInvalid ? "Required" : undefined}>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); markDirty(); }}
                    placeholder="Dr Hind Nadim"
                    invalid={nameInvalid}
                  />
                </Field>
                <Field
                  label="Phone"
                  required
                  hint={whatsappPreview || "Used to build the WhatsApp link."}
                  error={phoneInvalid ? "Required" : undefined}
                >
                  <Input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); markDirty(); }}
                    placeholder="06 06 23 96 19"
                    invalid={phoneInvalid}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Sector">
                  <Select value={sector} onChange={(e) => { setSector(e.target.value); markDirty(); }}>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Neighborhood / City">
                  <Input
                    value={neighborhood}
                    onChange={(e) => { setNeighborhood(e.target.value); markDirty(); }}
                    placeholder="Gueliz"
                  />
                </Field>
              </div>
            </div>
          </FormCard>

          <FormCard
            title="Online presence"
            subtitle="What does this prospect already have?"
            icon={<MessageCircle className="w-4 h-4" />}
          >
            <div className="space-y-5">
              <Field label="Instagram handle" hint={cleanInstagram ? `instagram.com/${cleanInstagram}` : "Optional — without the @."}>
                <Input
                  value={instagram}
                  onChange={(e) => { setInstagram(e.target.value); markDirty(); }}
                  placeholder="@drhindnadim"
                />
              </Field>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <Toggle
                  checked={hasWebsite}
                  onChange={(v) => { setHasWebsite(v); markDirty(); }}
                  label="Already has a website"
                  description="Affects scoring — if true, priority drops to P3."
                />
              </div>
            </div>
          </FormCard>
        </FormGridMain>

        <FormGridAside>
          <FormCard
            title="Scoring"
            subtitle="How hot is this lead?"
            icon={<Tag className="w-4 h-4" />}
          >
            <Field label="Priority" hint="P1 is hottest. Drives default sort and reminders.">
              <Select value={priority} onChange={(e) => { setPriority(Number(e.target.value)); markDirty(); }}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </Field>
          </FormCard>

          <FormCard
            title="Contact channels"
            subtitle="Preview of links built from the form."
            icon={<MapPin className="w-4 h-4" />}
          >
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-green-50 border border-green-100">
                <FaWhatsapp className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-[13px] text-[#0F172A] truncate">
                  {whatsappPreview || <span className="text-[#94A3B8]">Enter phone to preview</span>}
                </span>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-pink-50 border border-pink-100">
                <FaInstagram className="w-4 h-4 text-pink-600 shrink-0" />
                <span className="text-[13px] text-[#0F172A] truncate">
                  {cleanInstagram ? `instagram.com/${cleanInstagram}` : <span className="text-[#94A3B8]">No Instagram set</span>}
                </span>
              </div>
            </div>
          </FormCard>
        </FormGridAside>
      </FormGrid>
    </AdminFormLayout>
  );
}
