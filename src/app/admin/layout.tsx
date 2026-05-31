"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineSquares2X2,
  HiOutlineFolder,
  HiOutlineInbox,
  HiOutlineMegaphone,
  HiOutlineBolt,
  HiOutlineUserGroup,
  HiOutlineArrowRightStartOnRectangle,
} from "react-icons/hi2";

type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  avatarInitials: string;
};

const NAV = [
  { href: "/admin", label: "Overview", icon: HiOutlineSquares2X2 },
  { href: "/admin/prospecting", label: "Prospecting", icon: HiOutlineMegaphone },
  { href: "/admin/leads", label: "Leads", icon: HiOutlineInbox },
  { href: "/admin/projects", label: "Projects", icon: HiOutlineFolder },
  { href: "/admin/activity", label: "Activity", icon: HiOutlineBolt },
  { href: "/admin/team", label: "Team", icon: HiOutlineUserGroup, adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
    <div className="flex h-screen bg-[#F8F7FF]">
      {/* Sidebar */}
      <aside className="w-[260px] flex flex-col m-3 mr-0 rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
        {/* Logo */}
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">i</span>
            </div>
            <span className="text-[15px] font-semibold text-gray-900 tracking-tight">IBDA3 OS</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-200"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${active ? "text-white/90" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 mt-auto">
          {user && (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50/80">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
                {user.avatarInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-gray-800 truncate">{user.fullName}</p>
                <p className="text-[11px] text-gray-400 capitalize">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
                title="Logout"
              >
                <HiOutlineArrowRightStartOnRectangle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
