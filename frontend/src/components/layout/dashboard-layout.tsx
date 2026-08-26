"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderOpen, Database, Cpu, Box, BarChart3,
  FlaskConical, Key, Settings, Shield, ChevronLeft, ChevronRight,
  Zap, LogOut, Layers, Sparkles, X
} from "lucide-react";
import { toast } from "sonner";
import { tokenStorage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "./dashboard-header";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/training", label: "Training", icon: Cpu },
  { href: "/models", label: "Models", icon: Box },
  { href: "/predictions", label: "Predictions", icon: Sparkles },
  { href: "/batch-predictions", label: "Batch Jobs", icon: Layers },
  { href: "/evaluation", label: "Evaluation", icon: BarChart3 },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/api", label: "API Keys", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: Shield },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    tokenStorage.clear();
    toast.info("Signed out successfully.");
    router.push("/login");
  };

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + "/");

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
          active
            ? "bg-primary/20 text-white font-semibold shadow-sm"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-slate-400 group-hover:text-white")} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {active && !collapsed && (
          <motion.div
            layoutId="activeIndicator"
            className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
          />
        )}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-slate-800/80", collapsed && "justify-center px-2")}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="min-w-0"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-white tracking-tight">NeuralText</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/30 text-violet-300 font-bold uppercase tracking-wider">v1.0</span>
              </div>
              <span className="block text-[11px] text-slate-400 font-medium -mt-0.5">AI Classification SaaS</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {!collapsed && (
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Platform Menu
          </p>
        )}
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="p-3 pb-8 border-t border-slate-800/80 space-y-2 bg-slate-950/80">

        {/* ── Buy Me a Coffee (Official) ────────────────── */}
        <a
          href="https://www.buymeacoffee.com/dhananiyash"
          target="_blank"
          rel="noopener noreferrer"
          title="Buy me a coffee"
          className={`flex items-center transition-all duration-200 rounded-xl overflow-hidden hover:opacity-90 active:scale-95 ${
            collapsed ? "justify-center px-1 py-2 hover:bg-yellow-400/10" : "justify-center px-1 py-2"
          }`}
        >
          {collapsed ? (
            <span className="text-xl hover:scale-125 transition-transform" role="img" aria-label="coffee">☕</span>
          ) : (
            // Official BMC button image — exact branding
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              style={{ height: "42px", width: "auto", maxWidth: "100%", borderRadius: "10px" }}
            />
          )}
        </a>

        {/* ── Sign Out ─────────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-red-400/80 hover:bg-red-500/15 hover:text-red-300 transition-all font-medium"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden lg:flex flex-col relative flex-shrink-0 z-40 shadow-xl"
      >
        <SidebarContent />
        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-16 w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-primary transition-all z-50 shadow-md"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </motion.aside>

      {/* Mobile sidebar overlay & drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 z-50 shadow-2xl overflow-hidden"
            >
              <div className="relative h-full">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute top-4 right-3 text-slate-400 hover:text-white p-1 rounded-lg z-50"
                >
                  <X className="w-5 h-5" />
                </button>
                <SidebarContent />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content body */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        {/* World-class interactive header (elevated to z-50) */}
        <div className="relative z-50">
          <DashboardHeader onToggleMobileMenu={() => setMobileOpen(true)} />
        </div>

        {/* Page view content (layered at z-0) */}
        <main className="flex-1 overflow-y-auto relative z-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
