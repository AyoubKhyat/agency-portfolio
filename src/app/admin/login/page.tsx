"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/* The official iD monogram. Light surfaces use the transparent mark (dark strokes); dark surfaces use
   the app icon (white strokes on black), the same pairing the admin sidebar uses. */
function Monogram({ dark, size }: { dark: boolean; size: number }) {
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <Image
        src={dark ? "/icon.png" : "/loading/mark.png"}
        alt="Ibda3 Digital"
        fill
        sizes={`${size}px`}
        priority
        className={dark ? "object-contain" : "object-cover object-[50%_12%]"}
      />
    </span>
  );
}

const noopSubscribe = () => () => {};
function readDarkPreference(): boolean {
  let saved: string | null = null;
  try { saved = localStorage.getItem("os-dark"); } catch {}
  return saved === null ? window.matchMedia("(prefers-color-scheme: dark)").matches : saved === "true";
}

const field =
  "block w-full h-11 px-3.5 rounded-lg border bg-[var(--os-control-bg)] text-[15px] text-[var(--os-text)] " +
  "border-[var(--os-control-border)] placeholder:text-[var(--os-text-soft)] transition-colors " +
  "hover:border-[var(--os-border-hover)] focus:outline-none focus-visible:outline-none! focus-visible:rounded-lg! focus:border-[var(--os-brand)] " +
  "focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--os-brand)_18%,transparent)] " +
  "aria-[invalid=true]:border-[var(--os-danger-fg)]";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Same preference the admin shell uses (localStorage "os-dark"), falling back to the system setting.
  // null until it can be read in the browser.
  const dark = useSyncExternalStore(noopSubscribe, readDarkPreference, () => null);
  const emailRef = useRef<HTMLInputElement>(null);

  // autoFocus can't act while the page is hidden for the theme check, so focus once it is shown.
  const ready = dark !== null;
  useEffect(() => { if (ready) emailRef.current?.focus(); }, [ready]);

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

  const isDark = dark === true;

  return (
    <div
      className={cn(
        "admin-os min-h-dvh flex",
        isDark && "os-dark",
        dark === null && "invisible", // no light flash before the saved theme is known
      )}
      // inline: the unlayered `.admin-os { background: var(--os-bg) }` would beat a utility class
      style={{ background: "var(--os-surface)" }}
    >
      {/* Brand panel (desktop only): always black, the brand's base colour */}
      <aside className="hidden lg:flex w-[44%] max-w-[600px] flex-col justify-between bg-[#09090B] text-white px-14 py-12 border-r border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Monogram dark size={36} />
          <span className="text-[13px] font-medium tracking-[0.18em] text-white/70">IBDA3 DIGITAL</span>
        </div>

        <div>
          <span aria-hidden className="block h-[3px] w-12 rounded-full bg-[linear-gradient(90deg,#7C3AED,#2563EB)] mb-8" />
          <p className="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">Ibda3 OS</p>
          <p className="mt-4 max-w-[340px] text-[17px] leading-relaxed text-white/65">
            The operating system behind our client work: prospects, deals, projects and revenue in one place.
          </p>
        </div>

        <p className="text-[12px] text-white/50">Restricted access · Authorised team members only</p>
      </aside>

      {/* Sign-in */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[380px]">
            <div className="lg:hidden flex items-center gap-2.5 mb-10">
              <Monogram dark={isDark} size={32} />
              <span className="text-[12px] font-medium tracking-[0.18em] text-[var(--os-text-soft)]">IBDA3 DIGITAL</span>
            </div>

            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-[var(--os-text)]">Sign in</h1>
            <p className="mt-2 text-[15px] text-[var(--os-text-soft)]">Use your Ibda3 OS account to continue.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-[13px] font-medium text-[var(--os-text)] mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  ref={emailRef}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className={field}
                  placeholder="you@ibda3digital.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-[13px] font-medium text-[var(--os-text)] mb-1.5">
                  Password
                </label>
                <div className="relative">
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
                    className={cn(field, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center rounded-r-lg text-[var(--os-text-soft)] hover:text-[var(--os-text)] focus-visible:outline-none! focus-visible:rounded-l-none! focus-visible:rounded-r-lg! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--os-brand)]"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" aria-hidden /> : <Eye className="w-[18px] h-[18px]" aria-hidden />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--os-danger-border)] bg-[var(--os-danger-bg)] px-3.5 py-3 text-[14px] text-[var(--os-danger-fg)]"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading || undefined}
                className="group w-full h-11 rounded-lg bg-[var(--os-text)] text-[var(--os-surface)] text-[15px] font-medium flex items-center justify-center gap-2 transition-colors hover:bg-[color-mix(in_srgb,var(--os-text)_86%,var(--os-brand))] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none! focus-visible:rounded-lg! focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--os-surface)] focus-visible:ring-[var(--os-brand)]"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" aria-hidden />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <footer className="px-5 sm:px-8 pb-8 flex justify-center lg:justify-end">
          <p className="text-[12px] text-[var(--os-text-soft)] lg:hidden">Restricted access · Authorised team members only</p>
          <p className="hidden lg:block text-[12px] text-[var(--os-text-soft)]">© Ibda3 Digital</p>
        </footer>
      </main>
    </div>
  );
}
