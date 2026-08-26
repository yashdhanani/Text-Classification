"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatRelativeTime } from "@/lib/utils";
import {
  Shield, Users, Activity, Server, Database, Cpu,
  CheckCircle2, AlertTriangle, Clock, RefreshCw
} from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "audit" | "system">("users");

  const mockUsers = [
    { id: "u-1", name: "Admin Lead", email: "admin@neuraltext.ai", role: "admin", status: "active", created: "3 weeks ago" },
    { id: "u-2", name: "Sarah Chen", email: "sarah.chen@ai-team.io", role: "ml_engineer", status: "active", created: "2 weeks ago" },
    { id: "u-3", name: "David Miller", email: "david.m@analytics.org", role: "analyst", status: "active", created: "5 days ago" },
    { id: "u-4", name: "External API Integration", email: "svc-bot@service.internal", role: "user", status: "active", created: "1 day ago" },
  ];

  const mockLogs = [
    { id: "log-101", action: "MODEL_DEPLOY", user: "admin@neuraltext.ai", resource: "BERT-Classifier-v2 -> Production", ip: "192.168.1.10", time: "10 mins ago" },
    { id: "log-102", action: "API_KEY_CREATE", user: "sarah.chen@ai-team.io", resource: "Secret Key: Production Backend", ip: "10.0.4.12", time: "1 hour ago" },
    { id: "log-103", action: "DATASET_UPLOAD", user: "david.m@analytics.org", resource: "customer_reviews_50k.parquet", ip: "172.16.0.4", time: "3 hours ago" },
    { id: "log-104", action: "TRAIN_JOB_START", user: "sarah.chen@ai-team.io", resource: "Job: BiLSTM-MultiClass-Run-4", ip: "10.0.4.12", time: "5 hours ago" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Console & Governance</h1>
          <p className="text-muted-foreground mt-1">
            RBAC user permissions, immutable audit events, and distributed infrastructure telemetry.
          </p>
        </div>
      </motion.div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "API Gateway", status: "Operational", latency: "14ms", icon: Server, color: "text-emerald-500" },
          { label: "Celery Workers", status: "4 Active / 0 Stalled", latency: "Healthy", icon: Cpu, color: "text-emerald-500" },
          { label: "PostgreSQL DB", status: "Connected (Pool 12/50)", latency: "2ms", icon: Database, color: "text-emerald-500" },
          { label: "Redis Pub/Sub", status: "Connected", latency: "0.8ms", icon: Activity, color: "text-emerald-500" },
        ].map((node, i) => (
          <motion.div
            key={node.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between">
              <node.icon className={`w-5 h-5 ${node.color}`} />
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Online
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">{node.label}</p>
            <p className="text-xs text-muted-foreground">{node.status} · {node.latency}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-border bg-muted/20 px-4">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            User Roster & Roles ({mockUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "audit" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Security Audit Trail ({mockLogs.length})
          </button>
        </div>

        {activeTab === "users" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Member Since</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-muted uppercase">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium capitalize">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{u.created}</td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-medium transition-all">
                        Edit Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                  <th className="px-5 py-3 font-semibold">Event Action</th>
                  <th className="px-5 py-3 font-semibold">Initiated By</th>
                  <th className="px-5 py-3 font-semibold">Resource Context</th>
                  <th className="px-5 py-3 font-semibold">IP Origin</th>
                  <th className="px-5 py-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-xs text-primary">{log.action}</td>
                    <td className="px-5 py-4 text-xs text-foreground font-medium">{log.user}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground font-mono">{log.resource}</td>
                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{log.ip}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground text-right">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
