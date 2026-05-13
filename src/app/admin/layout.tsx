"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HiOutlineFolder, HiOutlineInbox, HiOutlineHome, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: HiOutlineHome },
  { href: "/admin/projects", label: "Projects", icon: HiOutlineFolder },
  { href: "/admin/leads", label: "Leads", icon: HiOutlineInbox },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [newLeads, setNewLeads] = useState(0);

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/admin/leads?status=NEW")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setNewLeads(d.total))
      .catch(() => {});
  }, [pathname, isLogin]);

  if (isLogin) return <>{children}</>;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="flex h-screen bg-[#0a0a14] text-gray-200">
      <aside className="w-64 border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-violet-400">Ibda3</span> Admin
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((item) => {
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
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
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
