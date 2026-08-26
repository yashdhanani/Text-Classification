"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { projectsApi, datasetsApi, modelsApi, trainingApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import {
  FolderOpen, Database, Box, Cpu, Sparkles, Plus,
  ArrowRight, Activity
} from "lucide-react";

import { useParams } from "next/navigation";

export default function ProjectDetailPage() {
  const urlParams = useParams();
  const projectId = (urlParams?.id as string) || "";

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(projectId),
  });

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => datasetsApi.list(projectId),
    enabled: Boolean(projectId),
  });

  const { data: models = [] } = useQuery({
    queryKey: ["models", projectId],
    queryFn: () => modelsApi.list(projectId),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["training-jobs", projectId],
    queryFn: () => trainingApi.listJobs(projectId),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{project?.name || "Project Overview"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Task: <span className="font-semibold text-foreground uppercase">{project?.task_type}</span> · Created {project?.created_at ? formatRelativeTime(project.created_at) : ""}
            </p>
          </div>
        </div>
        {project?.description && (
          <p className="text-sm text-muted-foreground mt-3 bg-muted/40 p-3.5 rounded-xl border border-border">
            {project.description}
          </p>
        )}
      </motion.div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Datasets", count: datasets.length, icon: Database, href: "/datasets", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Trained Models", count: models.length, icon: Box, href: "/models", color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Training Runs", count: jobs.length, icon: Cpu, href: "/training", color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">{item.label}</p>
                <p className="text-2xl font-bold mt-0.5">{item.count}</p>
              </div>
            </div>
            <Link href={item.href} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>

      {/* Models in this Project */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Box className="w-5 h-5 text-primary" />
            Models Associated with this Project
          </h2>
          <Link href="/training" className="text-xs text-primary font-semibold hover:underline">
            + Train New Model
          </Link>
        </div>

        {models.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No models trained in this project yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((m: any) => (
              <div key={m.id} className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{m.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.architecture?.toUpperCase()} · {m.num_classes} classes</p>
                </div>
                <Link
                  href={`/models/${m.id}/playground`}
                  className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold rounded-lg transition-all"
                >
                  Playground
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
