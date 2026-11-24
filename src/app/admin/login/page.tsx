"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import s from "./login.module.css";

const TITLE = "Ibda3 Digital";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // idle -> verifying (request in flight) -> success (API confirmed, brief welcome, then redirect)
  const [phase, setPhase] = useState<"idle" | "verifying" | "success">("idle");
  const inFlight = useRef(false);
  const redirectTimer = useRef<number | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Slight pointer parallax on the light and the tile. Writes CSS variables directly (no re-render);
  // skipped on touch-only devices and when the user prefers reduced motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--lx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--ly", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", onMove); };
  }, []);

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // one request at a time; stays locked after success until the redirect
    inFlight.current = true;
    setError("");
    setPhase("verifying");
    let ok = false;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      ok = res.ok;
    } catch {
      ok = false; // network failure: show the normal error instead of a stuck "Verifying…"
    }
    if (ok) {
      setPhase("success");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      redirectTimer.current = window.setTimeout(() => router.push("/admin"), reduce ? 400 : 800);
      return;
    }
    setError("Invalid email or password");
    setPhase("idle");
    inFlight.current = false;
  }

  return (
    <div ref={rootRef} className={s.root} data-phase={phase}>
      {/* Decorative light, hidden from assistive technology */}
      <div className={s.scene} aria-hidden>
        <div className={s.floor} />
        <div className={s.beam} />
        <div className={s.vignette} />
        <svg className={s.grain}>
          <filter id="login-grain">
            <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#login-grain)" />
        </svg>
      </div>

      <div className={s.drop}>
        <div className={s.tint} aria-hidden />
        <div className={s.rings} aria-hidden><i /><i /><i /></div>
        <div className={s.tile}>
          <span className={s.mark}>
            <Image src="/icon.png" alt="Ibda3 Digital" fill sizes="(max-width: 640px) 75px, 121px" priority className="object-contain" />
          </span>
          <span className={s.sheen} aria-hidden />
        </div>
      </div>

      <h1 className={s.heading} aria-label={TITLE}>
        {TITLE.split("").map((c, i) =>
          c === " " ? " " : (
            <span key={i} aria-hidden className={s.char} style={{ animationDelay: `${0.35 + i * 0.05}s` }}>{c}</span>
          ),
        )}
      </h1>
      <p className={cn(s.subtitle, s.rise)} style={{ animationDelay: "0.8s" }}>Your agency. One workspace.</p>

      <div className={s.stage}>
      <form onSubmit={handleSubmit} className={cn(s.form, s.rise)} style={{ animationDelay: "0.95s" }} aria-hidden={phase === "success" || undefined}>
        <div className={s.group}>
          <label htmlFor="login-email" className={s.label}>Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            readOnly={phase !== "idle"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            className={s.input}
            placeholder="you@ibda3digital.com"
          />
        </div>

        <div className={s.group}>
          <label htmlFor="login-password" className={s.label}>Password</label>
          <div className={s.inputWrap}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              readOnly={phase !== "idle"}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              className={cn(s.input, s.inputPassword)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className={s.toggle}
            >
              {showPassword ? <EyeOff className="w-[18px] h-[18px]" aria-hidden /> : <Eye className="w-[18px] h-[18px]" aria-hidden />}
            </button>
          </div>
        </div>

        {error && (
          <div id="login-error" role="alert" className={s.error}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={phase !== "idle"} aria-busy={phase === "verifying" || undefined} className={s.submit}>
          {phase !== "idle" ? (
            <>
              <span className={s.spinner} aria-hidden />
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" aria-hidden />
            </>
          )}
        </button>
      </form>

      {phase === "success" && (
        <div className={s.status} aria-hidden>
          <span className={s.check}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} /></svg>
          </span>
          <span className={s.welcome}>Welcome back</span>
        </div>
      )}
      </div>

      {/* Single announcement point for the sign-in progress; the visual status above is aria-hidden */}
      <p className="sr-only" role="status" aria-live="polite">
        {phase === "verifying" ? "Verifying…" : phase === "success" ? "Welcome back" : ""}
      </p>

      <p className={cn(s.footnote, s.rise)} style={{ animationDelay: "1.1s" }}>
        Restricted access for team members
      </p>
    </div>
  );
}
