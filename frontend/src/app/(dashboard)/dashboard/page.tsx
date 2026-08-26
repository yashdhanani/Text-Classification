"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { dashboardApi } from "@/lib/api";
import { formatNumber, formatMs, formatPercent } from "@/lib/utils";
import { MetricCard } from "@/components/shared/metric-card";
import { RecentActivity } from "@/components/shared/recent-activity";
import {
  Sparkles, Box, Database, Cpu, Clock, TrendingUp,
  Activity, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const SAMPLE_PREDICTIONS_OVER_TIME = [
  { date: "Aug 20", predictions: 1240 },
  { date: "Aug 21", predictions: 1890 },
  { date: "Aug 22", predictions: 2340 },
  { date: "Aug 23", predictions: 1780 },
  { date: "Aug 24", predictions: 3100 },
  { date: "Aug 25", predictions: 2890 },
  { date: "Aug 26", predictions: 4200 },
];

const SAMPLE_CLASS_DIST = [
  { name: "Positive", value: 42, color: "#22c55e" },
  { name: "Negative", value: 28, color: "#ef4444" },
  { name: "Neutral", value: 30, color: "#f59e0b" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.stats,
    staleTime: 30_000,
  });

  const metrics = [
    {
      label: "Total Predictions",
      value: isLoading ? "—" : formatNumber(stats?.total_predictions ?? 0),
      icon: Sparkles,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      trend: "+12.4%",
      trendUp: true,
    },
    {
      label: "Models",
      value: isLoading ? "—" : formatNumber(stats?.models ?? 0),
      icon: Box,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      trend: "+2",
      trendUp: true,
    },
    {
      label: "Datasets",
      value: isLoading ? "—" : formatNumber(stats?.datasets ?? 0),
      icon: Database,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      trend: "+5",
      trendUp: true,
    },
    {
      label: "Training Jobs",
      value: isLoading ? "—" : formatNumber(stats?.training_jobs ?? 0),
      icon: Cpu,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      trend: "3 running",
      trendUp: true,
    },
    {
      label: "Avg Confidence",
      value: isLoading ? "—" : formatPercent(stats?.avg_confidence ?? 0),
      icon: TrendingUp,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
      trend: "+0.8%",
      trendUp: true,
    },
    {
      label: "Avg Latency",
      value: isLoading ? "—" : formatMs(stats?.avg_latency_ms ?? 0),
      icon: Clock,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
      trend: "-4ms",
      trendUp: false,
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">
          Your AI platform overview at a glance.
        </p>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} custom={i} variants={cardVariants} initial="hidden" animate="visible">
            <MetricCard {...m} />
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Predictions over time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="xl:col-span-2 bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Predictions Over Time</h3>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
              <Activity className="w-4 h-4" />
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={SAMPLE_PREDICTIONS_OVER_TIME}>
              <defs>
                <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(262 83% 58%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="predictions"
                stroke="hsl(262 83% 58%)"
                strokeWidth={2}
                fill="url(#predGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Class distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <h3 className="font-semibold mb-1">Class Distribution</h3>
          <p className="text-sm text-muted-foreground mb-4">Latest predictions</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={SAMPLE_CLASS_DIST} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {SAMPLE_CLASS_DIST.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-card rounded-xl border border-border p-6"
      >
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "New Project", href: "/projects", color: "from-violet-500/20 to-purple-500/20 border-violet-500/30", icon: "🚀" },
            { label: "Upload Dataset", href: "/datasets", color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30", icon: "📊" },
            { label: "Train Model", href: "/training", color: "from-orange-500/20 to-amber-500/20 border-orange-500/30", icon: "🧠" },
            { label: "Run Prediction", href: "/predictions", color: "from-emerald-500/20 to-green-500/20 border-emerald-500/30", icon: "⚡" },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${action.color} border hover:scale-105 transition-transform cursor-pointer`}
            >
              <span className="text-3xl">{action.icon}</span>
              <span className="text-sm font-medium">{action.label}</span>
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
