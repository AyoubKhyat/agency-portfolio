"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type ContractData = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  paymentTerms: string;
  notes: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  partyName: string | null;
  agencyName: string;
};

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string; alreadySigned?: boolean }
  | { kind: "ready"; contract: ContractData }
  | { kind: "signed"; signedAt: string };

function formatDate(iso: string | null): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(value: number, currency: string): string {
  return (
    new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value) +
    " " +
    currency
  );
}

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Fetch contract data
  useEffect(() => {
    if (!token) return;
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setState({
            kind: "error",
            message: data.error || "Failed to load contract",
            alreadySigned: data.alreadySigned,
          });
          return;
        }
        setState({ kind: "ready", contract: data });
      })
      .catch(() => {
        setState({ kind: "error", message: "Network error. Please try again." });
      });
  }, [token]);

  // Initialize canvas
  useEffect(() => {
    if (state.kind !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 200 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = "200px";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#1E1B4B";
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [state.kind]);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      lastPosRef.current = getPos(e);
      setHasDrawn(true);
    },
    [getPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !lastPosRef.current) return;

      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    },
    [getPos]
  );

  const endDraw = useCallback(() => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  }, []);

  const handleSubmit = async () => {
    if (!canvasRef.current || !token) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const signatureData = canvasRef.current.toDataURL("image/png");

      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData, name, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit signature");
        return;
      }

      setState({ kind: "signed", signedAt: data.signedAt });
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = hasDrawn && name.trim().length > 0 && email.includes("@") && agreed && !submitting;

  // -- Loading --
  if (state.kind === "loading") {
    return (
      <div className="min-h-screen bg-[#FAFAFE] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280] text-sm">Loading contract...</p>
        </div>
      </div>
    );
  }

  // -- Error --
  if (state.kind === "error") {
    return (
      <div className="min-h-screen bg-[#FAFAFE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center shadow-sm">
          {state.alreadySigned ? (
            <>
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-[#111827] mb-2">Already Signed</h1>
              <p className="text-[#6B7280] text-sm">This contract has already been signed. No further action is needed.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-[#111827] mb-2">Link Invalid</h1>
              <p className="text-[#6B7280] text-sm">{state.message}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // -- Signed (success) --
  if (state.kind === "signed") {
    return (
      <div className="min-h-screen bg-[#FAFAFE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center shadow-sm">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#111827] mb-2">Contract Signed</h1>
          <p className="text-[#6B7280] text-sm mb-4">
            Your signature has been recorded successfully on{" "}
            {new Date(state.signedAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
          <p className="text-[#9CA3AF] text-xs">
            A confirmation will be sent to you. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  // -- Ready (signing form) --
  const { contract } = state;

  return (
    <div className="min-h-screen bg-[#FAFAFE]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A78BFA] to-[#8B6FE0] flex items-center justify-center">
              <span className="text-white text-sm font-bold">i</span>
            </div>
            <span className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
              {contract.agencyName}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111827] mt-3">
            {contract.title}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Please review the contract details below and sign to confirm your agreement.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Contract Details */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Contract Details</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                  Agency
                </p>
                <p className="text-sm font-medium text-[#111827]">{contract.agencyName}</p>
              </div>
              {contract.partyName && (
                <div>
                  <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                    Client
                  </p>
                  <p className="text-sm font-medium text-[#111827]">{contract.partyName}</p>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="pt-2 border-t border-[#F3F4F6]">
              <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                Amount
              </p>
              <p className="text-lg font-bold text-[#A78BFA]">
                {formatAmount(contract.amount, contract.currency)}
              </p>
            </div>

            {/* Dates */}
            {(contract.startDate || contract.endDate) && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F3F4F6]">
                {contract.startDate && (
                  <div>
                    <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                      Start Date
                    </p>
                    <p className="text-sm text-[#111827]">{formatDate(contract.startDate)}</p>
                  </div>
                )}
                {contract.endDate && (
                  <div>
                    <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                      End Date
                    </p>
                    <p className="text-sm text-[#111827]">{formatDate(contract.endDate)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Payment Terms */}
            {contract.paymentTerms && (
              <div className="pt-2 border-t border-[#F3F4F6]">
                <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                  Payment Terms
                </p>
                <p className="text-sm text-[#374151] whitespace-pre-wrap">{contract.paymentTerms}</p>
              </div>
            )}

            {/* Terms / Notes */}
            {contract.notes && (
              <div className="pt-2 border-t border-[#F3F4F6]">
                <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1">
                  Terms &amp; Conditions
                </p>
                <div className="text-sm text-[#374151] whitespace-pre-wrap bg-[#FAFAFE] rounded-lg p-3 max-h-60 overflow-y-auto">
                  {contract.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-semibold text-[#111827]">Your Signature</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/40 focus:border-[#A78BFA] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#D1D5DB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/40 focus:border-[#A78BFA] transition"
                />
              </div>
            </div>

            {/* Canvas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#374151]">
                  Draw your signature below <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs text-[#A78BFA] hover:text-[#8B6FE0] font-medium transition"
                >
                  Clear
                </button>
              </div>
              <div
                ref={containerRef}
                className="relative border-2 border-dashed border-[#D1D5DB] rounded-xl overflow-hidden bg-white cursor-crosshair"
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                  onTouchCancel={endDraw}
                  className="touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-[#D1D5DB] text-sm select-none">
                      Sign here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Agreement Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#D1D5DB] text-[#A78BFA] focus:ring-[#A78BFA]/40 accent-[#A78BFA]"
              />
              <span className="text-sm text-[#374151] leading-snug">
                I have read and agree to the contract terms outlined above. I understand that
                this electronic signature is legally binding.
              </span>
            </label>

            {/* Submit Error */}
            {submitError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-[#A78BFA] to-[#8B6FE0] hover:from-[#9575E8] hover:to-[#7C5FD0] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing...
                </span>
              ) : (
                "Sign Contract"
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#9CA3AF] pb-8">
          Powered by <span className="font-medium text-[#A78BFA]">Ibda3 Digital</span> &middot; Secure e-signature
        </p>
      </div>
    </div>
  );
}
