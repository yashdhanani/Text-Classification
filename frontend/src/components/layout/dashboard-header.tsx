"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Bell, Moon, Sun, ChevronRight, Zap, Shield,
  Key, Settings, LogOut, User, CheckCircle2, ExternalLink,
  Sparkles, Database, Box, Cpu, FolderOpen, ArrowRight, X,
  Command, Layers, HelpCircle
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { tokenStorage } from "@/lib/api";
import { cn } from "@/lib/utils";

// Route metadata for breadcrumbs
const PAGE_TITLES: Record<string, { label: string; icon: any; category: string }> = {
  dashboard: { label: "Dashboard", icon: Sparkles, category: "Platform" },
  projects: { label: "Projects", icon: FolderOpen, category: "Workspace" },
  datasets: { label: "Datasets", icon: Database, category: "Data Lake" },
  training: { label: "Training Jobs", icon: Cpu, category: "Pipelines" },
  models: { label: "Model Registry", icon: Box, category: "MLOps" },
  predictions: { label: "Interactive Inference", icon: Zap, category: "Serving" },
  "batch-predictions": { label: "Batch Predictions", icon: Layers, category: "Serving" },
  evaluation: { label: "Evaluation & Benchmarks", icon: Sparkles, category: "Analytics" },
  experiments: { label: "Experiment Tracker", icon: Sparkles, category: "Analytics" },
  api: { label: "API Keys & SDKs", icon: Key, category: "Developer" },
  settings: { label: "Settings", icon: Settings, category: "Account" },
  admin: { label: "Admin Console", icon: Shield, category: "Governance" },
};

const SEARCH_ITEMS = [
  { title: "Dashboard Overview", href: "/dashboard", category: "Navigation", icon: Sparkles },
  { title: "All Projects", href: "/projects", category: "Workspace", icon: FolderOpen },
  { title: "Dataset Upload & Previews", href: "/datasets", category: "Data", icon: Database },
  { title: "Launch Training Job", href: "/training", category: "Pipelines", icon: Cpu },
  { title: "Model Registry", href: "/models", category: "Models", icon: Box },
  { title: "BiLSTM Sentiment Playground", href: "/predictions", category: "Inference", icon: Zap },
  { title: "Model Evaluation & Benchmarks", href: "/evaluation", category: "Analytics", icon: Sparkles },
  { title: "Developer API Keys", href: "/api", category: "Developer", icon: Key },
  { title: "Platform Settings", href: "/settings", category: "Account", icon: Settings },
  { title: "Admin Console & Audit Trail", href: "/admin", category: "Governance", icon: Shield },
];

const NOTIFICATIONS = [
  {
    id: "n-1",
    title: "BiLSTM Sentiment Engine deployed",
    description: "Model promoted to Production stage with 94.2% accuracy.",
    time: "10m ago",
    unread: true,
    type: "success",
  },
  {
    id: "n-2",
    title: "Enterprise dataset processed",
    description: "500 records vectorized with zero-leakage tokenizer.",
    time: "1h ago",
    unread: true,
    type: "info",
  },
  {
    id: "n-3",
    title: "API Key Rate Limit Normal",
    description: "Sub-15ms average latency maintained across inference cluster.",
    time: "3h ago",
    unread: false,
    type: "neutral",
  },
];

export function DashboardHeader({ onToggleMobileMenu }: { onToggleMobileMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Global shortcut (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    tokenStorage.clear();
    toast.info("Signed out successfully.");
    router.push("/login");
  };

  // Build breadcrumbs from path
  const pathSegments = pathname.split("/").filter(Boolean);
  const currentSegment = pathSegments[pathSegments.length - 1] || "dashboard";
  const pageMeta = PAGE_TITLES[currentSegment] || {
    label: currentSegment.charAt(0).toUpperCase() + currentSegment.slice(1),
    icon: Sparkles,
    category: "Platform",
  };
  const PageIcon = pageMeta.icon;

  const filteredSearch = SEARCH_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="h-16 border-b border-border/70 bg-card/90 backdrop-blur-xl px-6 flex items-center justify-between gap-4 sticky top-0 relative z-50 transition-colors shadow-sm">
        {/* Left: Breadcrumbs & Page title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all -ml-2"
          >
            <Zap className="w-5 h-5 text-primary" />
          </button>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-primary/70" />
              <span>NeuralText</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-muted-foreground/70 hidden sm:inline">{pageMeta.category}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 hidden sm:inline flex-shrink-0" />
            <div className="flex items-center gap-1.5 font-semibold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-md">
              <PageIcon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[160px] sm:max-w-xs">{pageMeta.label}</span>
            </div>
          </div>
        </div>

        {/* Center: Command Bar Trigger */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs text-muted-foreground transition-all group shadow-sm hover:border-primary/40"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Search models, datasets, docs, actions...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-muted-foreground font-semibold">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right: Actions, System Status, Notifications & Profile */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Live Cluster Status Badge */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>API Online · 12ms</span>
          </div>

          {/* API Docs Button */}
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all shadow-sm"
          >
            <span>API Docs</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-transparent hover:border-border"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Notifications Center */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                setUserMenuOpen(false);
              }}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all relative border border-transparent hover:border-border"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 p-1"
                >
                  <div className="p-3.5 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Notifications</h3>
                      <p className="text-[11px] text-muted-foreground">Platform updates and job events</p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => setUnreadCount(0)}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-border/50 p-1">
                    {NOTIFICATIONS.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "p-3 rounded-xl hover:bg-muted/50 transition-colors flex items-start gap-3",
                          n.unread && "bg-primary/5"
                        )}
                      >
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                          <span className="text-[10px] text-muted-foreground/70 mt-1 block">{n.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-2 border-t border-border bg-muted/20 text-center">
                    <Link
                      href="/training"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      View all training logs →
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* User Profile Menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-muted/60 border border-transparent hover:border-border transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-primary/20">
                A
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-semibold text-foreground leading-none">Admin Lead</p>
                <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">Enterprise Admin</span>
              </div>
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 p-2 space-y-1"
                >
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-1">
                    <p className="text-xs font-bold text-foreground">Admin Lead</p>
                    <p className="text-[11px] text-muted-foreground truncate">admin@neuraltext.ai</p>
                    <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary font-semibold uppercase tracking-wider">
                      Role: System Admin
                    </span>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Account Settings
                  </Link>

                  <Link
                    href="/api"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Key className="w-4 h-4 text-muted-foreground" />
                    API Credentials
                  </Link>

                  <Link
                    href="/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    Governance & Audit
                  </Link>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Global Command Palette / Search Modal (⌘K) */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Search input header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Search className="w-5 h-5 text-primary flex-shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a command, model name, or jump to page..."
                  className="w-full bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search results list */}
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {filteredSearch.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    No matching commands or pages found.
                  </div>
                ) : (
                  filteredSearch.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <item.icon className="w-4 h-4 text-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary">{item.title}</p>
                          <span className="text-[10px] text-muted-foreground">{item.category}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                    </Link>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Navigate with mouse or keyboard</span>
                <kbd className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-mono">ESC to close</kbd>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
