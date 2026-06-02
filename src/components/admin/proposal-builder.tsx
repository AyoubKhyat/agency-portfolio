"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, FileText, Check, Package } from "lucide-react";
import { Badge } from "@/components/admin/badge";
import { Field, Input, Textarea, FormButton, FormError } from "@/components/admin/form";
import { cn } from "@/lib/utils";

type ProposalBuilderProps = {
  prospectId: string;
  prospectName: string;
  sector: string;
  onClose: () => void;
  onCreated: () => void;
};

const SERVICES = [
  "Website Vitrine",
  "E-commerce",
  "Branding",
  "SEO Local",
  "Social Media Design",
  "AI Chatbot",
  "WhatsApp Automation",
  "Custom Web App",
  "Maintenance",
];

const PACKAGES = [
  {
    name: "Starter Website",
    services: ["Website Vitrine", "SEO Local"],
    amount: 5000,
    timeline: "2-3 weeks",
    description: "Website vitrine + WhatsApp button + Contact form + Basic SEO",
  },
  {
    name: "Growth Package",
    services: ["Website Vitrine", "SEO Local", "Social Media Design"],
    amount: 12000,
    timeline: "4-6 weeks",
    description: "Website premium + SEO local + Google Business + Analytics",
  },
  {
    name: "Automation Package",
    services: ["Custom Web App", "WhatsApp Automation", "AI Chatbot"],
    amount: 20000,
    timeline: "6-8 weeks",
    description: "Website + CRM + WhatsApp automation + AI assistant",
  },
  {
    name: "E-commerce Package",
    services: ["E-commerce", "SEO Local", "Maintenance"],
    amount: 15000,
    timeline: "4-6 weeks",
    description: "Online shop + Product management + Payment + Stock",
  },
];

export function ProposalBuilder({
  prospectId,
  prospectName,
  sector,
  onClose,
  onCreated,
}: ProposalBuilderProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [contactPerson, setContactPerson] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [amount, setAmount] = useState<number | "">("");
  const [timeline, setTimeline] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePackageSelect(pkg: (typeof PACKAGES)[number]) {
    if (selectedPackage === pkg.name) {
      setSelectedPackage(null);
      setSelectedServices([]);
      setAmount("");
      setTimeline("");
      return;
    }
    setSelectedPackage(pkg.name);
    setSelectedServices([...pkg.services]);
    setAmount(pkg.amount);
    setTimeline(pkg.timeline);
  }

  function toggleService(service: string) {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
    setSelectedPackage(null);
  }

  async function handleSubmit(status: "DRAFT" | "SENT") {
    if (!amount) {
      setError("Amount is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId,
          contactPerson: contactPerson || undefined,
          services: selectedServices.join(", "),
          amount: Number(amount),
          timeline: timeline || undefined,
          paymentTerms: paymentTerms || undefined,
          notes: notes || undefined,
          packageName: selectedPackage || undefined,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to create proposal (${res.status})`);
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[#E5E7EB]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10">
                    <FileText className="w-4.5 h-4.5 text-[#8B00FF]" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-[#0F172A]">Create Proposal</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[13px] text-[#475569]">{prospectName}</p>
                      <Badge variant="default" size="sm">{sector}</Badge>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-6">
              <div>
                <label className="block text-[12px] font-semibold text-[#0F172A] uppercase tracking-wider mb-3">
                  Package Templates
                </label>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                  {PACKAGES.map((pkg) => (
                    <button
                      key={pkg.name}
                      onClick={() => handlePackageSelect(pkg)}
                      className={cn(
                        "shrink-0 w-[180px] p-3.5 rounded-xl border text-left transition-all",
                        selectedPackage === pkg.name
                          ? "border-[#8B00FF] bg-gradient-to-br from-[#8B00FF]/5 to-[#C026D3]/5 ring-2 ring-[#8B00FF]/20"
                          : "border-[#E5E7EB] bg-white hover:border-[#8B00FF]/30 hover:bg-[#FAFAFE]"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Package className={cn(
                          "w-4 h-4",
                          selectedPackage === pkg.name ? "text-[#8B00FF]" : "text-[#64748B]"
                        )} />
                        <span className={cn(
                          "text-[13px] font-semibold",
                          selectedPackage === pkg.name ? "text-[#8B00FF]" : "text-[#0F172A]"
                        )}>
                          {pkg.name}
                        </span>
                      </div>
                      <p className="text-[18px] font-bold text-[#0F172A] mb-1">
                        {pkg.amount.toLocaleString()} <span className="text-[11px] font-medium text-[#64748B]">MAD</span>
                      </p>
                      <p className="text-[11px] text-[#64748B] leading-relaxed line-clamp-2">
                        {pkg.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Contact person" hint="Optional — who you're sending this to.">
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Sarah Bennani"
                />
              </Field>

              <div>
                <label className="block text-[12px] font-semibold text-[#0F172A] uppercase tracking-wider mb-3">
                  Services
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICES.map((service) => {
                    const checked = selectedServices.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all text-[13px]",
                          checked
                            ? "border-[#8B00FF]/40 bg-[#8B00FF]/5 text-[#8B00FF] font-medium"
                            : "border-[#E5E7EB] bg-white text-[#475569] hover:border-[#8B00FF]/20 hover:bg-[#FAFAFE]"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center w-4.5 h-4.5 rounded-md border transition-all shrink-0",
                          checked
                            ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] border-transparent"
                            : "border-[#D1D5DB] bg-white"
                        )}>
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {service}
                      </button>
                    );
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedServices.map((s) => (
                      <Badge key={s} variant="purple" size="sm">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount" required>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                      placeholder="0"
                      min={0}
                      className="pr-14"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#64748B]">
                      MAD
                    </span>
                  </div>
                </Field>
                <Field label="Timeline">
                  <Input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. 2-3 weeks"
                  />
                </Field>
              </div>

              <Field label="Payment terms">
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="50% upfront, 50% on delivery"
                />
              </Field>

              <Field label="Notes" hint="Internal context, scope details or next steps.">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this proposal..."
                  rows={3}
                />
              </Field>

              <FormError message={error} />
            </div>
          </div>

          <div className="shrink-0 px-6 py-4 border-t border-[#E5E7EB] bg-[#F8FAFC]">
            <div className="flex items-center gap-3">
              <FormButton
                type="button"
                variant="secondary"
                onClick={() => handleSubmit("DRAFT")}
                disabled={submitting}
                icon={!submitting ? <FileText className="w-4 h-4" /> : undefined}
                loading={submitting}
                className="flex-1"
              >
                Save as draft
              </FormButton>
              <FormButton
                type="button"
                variant="primary"
                onClick={() => handleSubmit("SENT")}
                disabled={submitting}
                icon={!submitting ? <Check className="w-4 h-4" /> : undefined}
                loading={submitting}
                className="flex-1"
              >
                Create proposal
              </FormButton>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
