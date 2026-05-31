"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Target, Building2, FolderKanban,
  BarChart3, Settings, LogOut, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads", icon: Users, badgeKey: "leads" as const },
      { href: "/admin/prospecting", label: "Prospecting", icon: Target, badgeKey: "prospects" as const },
      { href: "/admin/clients", label: "Clients", icon: Building2 },
    ],
  },
  { label: "Portfolio", items: [{ href: "/admin/projects", label: "Projects", icon: FolderKanban }] },
  { label: "Intelligence", items: [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 }] },
];

const BOTTOM_NAV = [{ href: "/admin/settings", label: "Settings", icon: Settings }];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState({ leads: 0, prospects: 0 });
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("os-sidebar");
      if (saved === "collapsed") setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (isLogin) return;
    Promise.all([
      fetch("/api/admin/leads?status=NEW").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting?status=A_ENVOYER").then((r) => r.ok ? r.json() : null),
    ]).then(([ld, pd]) => {
      setBadges({ leads: ld?.total || 0, prospects: pd?.total || 0 });
    }).catch(() => {});
  }, [pathname, isLogin]);

  if (isLogin) return <>{children}</>;

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("os-sidebar", next ? "collapsed" : "expanded");
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div className="admin-os flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-[var(--os-border)] bg-white/60 backdrop-blur-xl transition-all duration-200 ease-out shrink-0 shadow-[1px_0_20px_-5px_rgba(139,92,246,0.05)]",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}>
        {/* Brand */}
        <div className={cn("flex items-center h-14 border-b border-[var(--os-border)]", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md shadow-purple-500/20">
              <span className="text-white text-xs font-bold">I</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/20">
                <span className="text-white text-[10px] font-bold">I</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-900 leading-none">IBDA3</div>
                <div className="text-[10px] text-gray-400 leading-none mt-0.5">OS</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em] px-2 mb-1.5">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl transition-all duration-150",
                        collapsed ? "justify-center h-9 w-9 mx-auto" : "px-2.5 py-[7px]",
                        active
                          ? "bg-gradient-to-r from-purple-100/80 to-violet-50/50 text-purple-700 shadow-sm shadow-purple-500/[0.06]"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/60"
                      )}
                    >
                      {active && !collapsed && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gradient-to-b from-purple-500 to-violet-500"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <item.icon className={cn("shrink-0", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")} />
                      {!collapsed && (
                        <>
                          <span className="text-[13px] font-medium">{item.label}</span>
                          {badge > 0 && (
                            <span className="ml-auto text-[10px] font-semibold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                              {badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && badge > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-[var(--os-border)] py-2 px-2 space-y-0.5">
          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl transition-all duration-150",
                  collapsed ? "justify-center h-9 w-9 mx-auto" : "px-2.5 py-[7px]",
                  active ? "bg-purple-100/80 text-purple-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/60"
                )}>
                <item.icon className={cn("shrink-0", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")} />
                {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
              </Link>
            );
          })}
          <button onClick={handleLogout} title={collapsed ? "Logout" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl transition-all duration-150 w-full text-gray-400 hover:text-red-500 hover:bg-red-50",
              collapsed ? "justify-center h-9 w-9 mx-auto" : "px-2.5 py-[7px]"
            )}>
            <LogOut className={cn("shrink-0", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")} />
            {!collapsed && <span className="text-[13px] font-medium">Logout</span>}
          </button>
          <button onClick={toggleSidebar}
            className={cn(
              "flex items-center gap-2.5 rounded-xl transition-all duration-150 w-full text-gray-400 hover:text-gray-600 hover:bg-gray-100/60",
              collapsed ? "justify-center h-9 w-9 mx-auto" : "px-2.5 py-[7px]"
            )}>
            {collapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <><PanelLeftClose className="w-4 h-4" /><span className="text-[13px] font-medium">Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-[1400px]">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
