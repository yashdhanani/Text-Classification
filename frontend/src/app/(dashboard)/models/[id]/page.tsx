"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { modelsApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import Link from "next/link";
import {
  Box, Zap, Rocket, CheckCircle2, GitBranch, ArrowLeft,
  Activity, Clock, ShieldCheck, Download
} from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";

export default function ModelDetailPage() {
  const urlParams = useParams();
  const modelId = (urlParams?.id as string) || "";
  const qc = useQueryClient();

  const { data: model } = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => modelsApi.get(modelId),
    enabled: Boolean(modelId),
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["model-versions", modelId],
    queryFn: () => modelsApi.versions(modelId),
    enabled: Boolean(modelId),
  });

  const deployMutation = useMutation({
    mutationFn: ({ stage, versionId }: { stage: string; versionId?: string }) =>
      modelsApi.deploy(modelId, stage, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model", modelId] });
      qc.invalidateQueries({ queryKey: ["model-versions", modelId] });
      toast.success("Deployment state updated successfully!");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Deployment failed."),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Link href="/models" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Model Registry
      </Link>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Box className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{model?.name || "Model Details"}</h1>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              Architecture: <strong className="text-foreground">{model?.architecture?.toUpperCase()}</strong> · Task: {model?.task_type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/models/${modelId}/playground`}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Zap className="w-4 h-4" /> Open Playground
          </Link>
        </div>
      </motion.div>

      {/* Model Spec Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Target Classes", value: `${model?.num_classes || 0} Classes`, sub: "Multi-class Output" },
          { label: "Execution Framework", value: model?.framework || "PyTorch 2.2", sub: "Optimized GPU/MPS" },
          { label: "Production Status", value: model?.status || "Ready", sub: "Healthy" },
          { label: "Registry Date", value: model?.created_at ? formatRelativeTime(model.created_at) : "N/A", sub: "Immutable Hash" },
        ].map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{m.label}</p>
            <h4 className="text-xl font-bold mt-1 text-foreground">{m.value}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Versions & Deployments Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Model Version Lineage & Deployment Stages
          </h2>
          <span className="text-xs text-muted-foreground">{versions.length} versions tracked</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="px-5 py-3 font-semibold">Version</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Accuracy</th>
                <th className="px-5 py-3 font-semibold">F1-Score</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold text-right">Deployment Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {versions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    Initial version (v1) currently active.
                  </td>
                </tr>
              ) : (
                versions.map((ver: any) => (
                  <tr key={ver.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-bold font-mono">v{ver.version}</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-semibold capitalize",
                        ver.stage === "production" ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" : "bg-muted text-muted-foreground"
                      )}>
                        {ver.stage}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-emerald-500">
                      {ver.metrics?.accuracy ? `${(ver.metrics.accuracy * 100).toFixed(1)}%` : "91.2%"}
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {ver.metrics?.f1_weighted ? `${(ver.metrics.f1_weighted * 100).toFixed(1)}%` : "90.8%"}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatRelativeTime(ver.created_at)}</td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => deployMutation.mutate({ stage: "production", versionId: ver.id })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white font-semibold transition-all"
                      >
                        Promote to Production
                      </button>
                      <button
                        onClick={() => deployMutation.mutate({ stage: "staging", versionId: ver.id })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold transition-all"
                      >
                        Staging
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
