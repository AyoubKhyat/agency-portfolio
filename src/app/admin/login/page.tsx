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
  const [loading, setLoading] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { router.push("/admin"); } else { setError("Invalid email or password"); }
    setLoading(false);
  }

  return (
    <div ref={rootRef} className={s.root}>
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

      <form onSubmit={handleSubmit} className={cn(s.form, s.rise)} style={{ animationDelay: "0.95s" }}>
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

        <button type="submit" disabled={loading} aria-busy={loading || undefined} className={s.submit}>
          {loading ? (
            <>
              <span className={s.spinner} aria-hidden />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" aria-hidden />
            </>
          )}
        </button>
      </form>

      <p className={cn(s.footnote, s.rise)} style={{ animationDelay: "1.1s" }}>
        Restricted access for team members
      </p>
    </div>
  );
}
