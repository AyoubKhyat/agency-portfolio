"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HiOutlineFolder, HiOutlineInbox, HiOutlineHome, HiOutlineArrowRightOnRectangle, HiOutlineMegaphone, HiOutlineUserGroup, HiOutlineBolt } from "react-icons/hi2";

type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  avatarInitials: string;
};

const NAV = [
  { href: "/admin", label: "Dashboard", icon: HiOutlineHome },
  { href: "/admin/projects", label: "Projects", icon: HiOutlineFolder },
  { href: "/admin/leads", label: "Leads", icon: HiOutlineInbox },
  { href: "/admin/prospecting", label: "Prospecting", icon: HiOutlineMegaphone },
  { href: "/admin/activity", label: "Activity", icon: HiOutlineBolt },
  { href: "/admin/team", label: "Team", icon: HiOutlineUserGroup, adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [newLeads, setNewLeads] = useState(0);
  const [pendingProspects, setPendingProspects] = useState(0);
  const [user, setUser] = useState<SessionUser | null>(null);

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setUser(d);
        else router.push("/admin/login");
      })
      .catch(() => {});
    fetch("/api/admin/leads?status=NEW")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setNewLeads(d.total))
      .catch(() => {});
    fetch("/api/admin/prospecting?status=A_ENVOYER")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPendingProspects(d.total))
      .catch(() => {});
  }, [pathname, isLogin, router]);

  if (isLogin) return <>{children}</>;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const visibleNav = NAV.filter((item) => {
    if ("adminOnly" in item && item.adminOnly && user?.role !== "admin") return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#0a0a14] text-gray-200">
      <aside className="w-64 border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-violet-400">IBDA3</span> OS
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-violet-500/15 text-violet-400" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.label === "Leads" && newLeads > 0 && (
                  <span className="ml-auto bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {newLeads}
                  </span>
                )}
                {item.label === "Prospecting" && pendingProspects > 0 && (
                  <span className="ml-auto bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingProspects}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          {user && (
            <div className="flex items-center gap-3 px-3">
              <span className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-400">
                {user.avatarInitials}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{user.fullName}</p>
                <p className="text-[10px] text-gray-500 uppercase">{user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors w-full"
          >
            <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
