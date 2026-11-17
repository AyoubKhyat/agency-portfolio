"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="admin-os min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F7F7FB] via-[#F0EEFF] to-[#F7F7FB]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-200/30 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-blue-200/20 blur-[80px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-sm mx-4 sm:mx-auto"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-300/30">
            <span className="text-white text-lg font-bold">I</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            IBDA3 <span className="text-gray-400 font-normal">OS</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your workspace</p>
        </div>

        {/* Form card */}
        <div className="p-7 border border-[rgba(120,120,180,0.12)] rounded-2xl bg-white/80 backdrop-blur-xl shadow-xl shadow-purple-500/[0.04]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-gray-50/80 border border-[rgba(120,120,180,0.12)] rounded-xl text-sm text-gray-800 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all placeholder:text-gray-400"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-gray-50/80 border border-[rgba(120,120,180,0.12)] rounded-xl text-sm text-gray-800 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-purple-300/30"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Lock className="w-3.5 h-3.5" /> Sign In</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">Ibda3 Digital &mdash; Agency Operating System</p>
      </motion.div>
    </div>
  );
}
