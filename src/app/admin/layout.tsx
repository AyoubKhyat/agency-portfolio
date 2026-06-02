"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Target, Building2, FolderKanban,
  BarChart3, Settings, LogOut, PanelLeftClose, PanelLeft, Menu, X,
  Activity, UsersRound, Bell, Search, Layers, Shield, CheckSquare, BellRing,
  Calendar, FileSignature,
} from "lucide-react";
import { CommandPalette } from "@/components/admin/command-palette";
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
  {
    label: "Operations",
    items: [
      { href: "/admin/tasks", label: "Tasks", icon: CheckSquare, badgeKey: "tasks" as const },
      { href: "/admin/notifications", label: "Notifications", icon: BellRing, badgeKey: "notifications" as const },
      { href: "/admin/activity", label: "Activity Feed", icon: Activity, badgeKey: "activities" as const },
      { href: "/admin/team", label: "Team", icon: UsersRound, badgeKey: "team" as const },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/admin/meetings", label: "Meetings", icon: Calendar, badgeKey: "meetings" as const },
      { href: "/admin/pipeline", label: "Pipeline", icon: Layers },
      { href: "/admin/contracts", label: "Contracts", icon: FileSignature, badgeKey: "contracts" as const },
    ],
  },
  { label: "Portfolio", items: [{ href: "/admin/projects", label: "Projects", icon: FolderKanban }] },
  { label: "Intelligence", items: [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 }] },
];

const BOTTOM_NAV = [
  { href: "/admin/system-status", label: "System Status", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/admin") return "Dashboard";
  const segment = pathname.split("/").filter(Boolean)[1];
  if (!segment) return "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [badges, setBadges] = useState({ leads: 0, prospects: 0, activities: 0, team: 0, tasks: 0, notifications: 0, meetings: 0, contracts: 0 });
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("os-sidebar");
      if (saved === "collapsed") setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/admin/notifications/count")
      .then((r) => (r.ok ? r.json() : { unread: 0 }))
      .then((d: { unread: number }) => setUnreadNotifs(d.unread || 0))
      .catch(() => {});
  }, [pathname, isLogin]);

  useEffect(() => {
    if (isLogin) return;
    Promise.all([
      fetch("/api/admin/leads?status=NEW").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting?status=A_ENVOYER").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/activity?limit=20").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/users").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/tasks?scope=mine&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/notifications/count").then((r) => r.ok ? r.json() : { unread: 0 }),
      fetch("/api/admin/meetings?scope=today&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/contracts?status=PENDING_SIGNATURE&limit=500").then((r) => r.ok ? r.json() : []),
    ]).then(([ld, pd, acts, users, myTasks, notifCount, mToday, pendingContracts]) => {
      const today = new Date().toDateString();
      const todayCount = Array.isArray(acts) ? acts.filter((a: { createdAt: string }) => new Date(a.createdAt).toDateString() === today).length : 0;
      setBadges({
        leads: ld?.total || 0,
        prospects: pd?.total || 0,
        activities: todayCount,
        team: Array.isArray(users) ? users.length : 0,
        tasks: Array.isArray(myTasks) ? myTasks.length : 0,
        notifications: notifCount?.unread || 0,
        meetings: Array.isArray(mToday) ? mToday.length : 0,
        contracts: Array.isArray(pendingContracts) ? pendingContracts.length : 0,
      });
    }).catch(() => {});
  }, [pathname, isLogin]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

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

  const sidebarContent = (isMobileDrawer = false) => (
    <>
      {/* Brand */}
      <div className={cn("flex items-center h-14 border-b border-[var(--os-border)]", collapsed && !isMobileDrawer ? "justify-center px-2" : "px-5")}>
        {collapsed && !isMobileDrawer ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-white text-xs font-bold">I</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/25">
              <span className="text-white text-[11px] font-bold">I</span>
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#0F172A] leading-none tracking-tight">IBDA3</div>
              <div className="text-[10px] text-[#64748B] leading-none mt-0.5 font-medium tracking-widest">OS</div>
            </div>
          </div>
        )}
        {isMobileDrawer && (
          <button onClick={closeMobile} className="ml-auto p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {(!collapsed || isMobileDrawer) && (
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] px-2 mb-2">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                const showLabel = !collapsed || isMobileDrawer;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!showLabel ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-xl transition-all duration-200",
                      !showLabel ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2",
                      active
                        ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20"
                        : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                    )}
                  >
                    <item.icon className={cn("shrink-0", !showLabel ? "w-[18px] h-[18px]" : "w-[16px] h-[16px]")} />
                    {showLabel && (
                      <>
                        <span className="text-[13px] font-medium">{item.label}</span>
                        {badge > 0 && (
                          <span className={cn(
                            "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                            active ? "bg-white/25 text-white" : "bg-purple-100 text-[#8B00FF]"
                          )}>
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                    {!showLabel && badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#8B00FF] rounded-full border-2 border-white" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--os-border)] py-3 px-3 space-y-1">
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item.href);
          const showLabel = !collapsed || isMobileDrawer;
          return (
            <Link key={item.href} href={item.href} title={!showLabel ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl transition-all duration-200",
                !showLabel ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2",
                active ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20" : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              )}>
              <item.icon className={cn("shrink-0", !showLabel ? "w-[18px] h-[18px]" : "w-4 h-4")} />
              {showLabel && <span className="text-[13px] font-medium">{item.label}</span>}
            </Link>
          );
        })}
        <button onClick={handleLogout} title={(!collapsed || isMobileDrawer) ? undefined : "Logout"}
          className={cn(
            "flex items-center gap-2.5 rounded-xl transition-all duration-200 w-full text-[#94A3B8] hover:text-red-500 hover:bg-red-50/80",
            (!collapsed || isMobileDrawer) ? "px-3 py-2" : "justify-center h-10 w-10 mx-auto"
          )}>
          <LogOut className={cn("shrink-0", (!collapsed || isMobileDrawer) ? "w-4 h-4" : "w-[18px] h-[18px]")} />
          {(!collapsed || isMobileDrawer) && <span className="text-[13px] font-medium">Logout</span>}
        </button>
        {!isMobileDrawer && (
          <button onClick={toggleSidebar}
            className={cn(
              "hidden lg:flex items-center gap-2.5 rounded-xl transition-all duration-200 w-full text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9]",
              collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2"
            )}>
            {collapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <><PanelLeftClose className="w-4 h-4" /><span className="text-[13px] font-medium">Collapse</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="admin-os flex h-screen overflow-hidden">
      {/* Background gradient blobs */}
      <div className="os-gradient-blob os-gradient-blob-1" />
      <div className="os-gradient-blob os-gradient-blob-2" />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white/90 backdrop-blur-xl border-b border-[var(--os-border)] shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shadow-sm shadow-purple-500/20">
              <span className="text-white text-[9px] font-bold">I</span>
            </div>
            <span className="text-sm font-bold text-[#0F172A]">{getPageTitle(pathname)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
            <Search className="w-5 h-5" />
          </button>
          <Link
            href="/admin/notifications"
            aria-label="Notifications"
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] relative"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />}
          </Link>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] flex flex-col bg-white border-r border-[var(--os-border)] shadow-2xl shadow-purple-900/10"
          >
            {sidebarContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:block shrink-0 py-3 pl-3 transition-all duration-200 ease-out",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}>
        <aside className="flex flex-col h-[calc(100vh-24px)] bg-white/90 backdrop-blur-xl rounded-2xl border border-[var(--os-border)] shadow-lg shadow-purple-900/[0.03] overflow-hidden">
          {sidebarContent(false)}
        </aside>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 lg:pt-0 relative z-[1]">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
