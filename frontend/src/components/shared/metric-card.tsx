"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  trend?: string;
  trendUp?: boolean;
}

export function MetricCard({ label, value, icon: Icon, color, bg, trend, trendUp }: MetricCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 card-lift">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
              trendUp
                ? "text-emerald-600 bg-emerald-500/10"
                : "text-red-500 bg-red-500/10"
            )}
          >
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <motion.p
        className="text-2xl font-bold"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {value}
      </motion.p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
