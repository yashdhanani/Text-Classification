"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { modelsApi } from "@/lib/api";
import { formatRelativeTime, getStatusColor, cn } from "@/lib/utils";
import { Box, Zap, GitBranch, MoreHorizontal, ChevronRight, Rocket } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ModelsPage() {
  const qc = useQueryClient();
  const { data: models = [], isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list(),
  });

  const deployMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      modelsApi.deploy(id, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["models"] });
      toast.success("Model deployed!");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Deployment failed."),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Model Registry</h1>
        <p className="text-muted-foreground mt-1">Manage and deploy trained NLP models.</p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-card border border-border shimmer" />)}
        </div>
      ) : (models as any[]).length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Box className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No models yet</p>
          <p className="text-sm mt-1">Models appear here after training jobs complete.</p>
          <Link href="/training" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            Start Training →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {(models as any[]).map((model: any, i: number) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-5 card-lift group flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Box className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold truncate max-w-[140px]">{model.name}</h3>
                    <span className="text-xs text-muted-foreground">{model.architecture?.toUpperCase()}</span>
                  </div>
                </div>
                <span className={cn("text-xs px-2.5 py-1 rounded-full", getStatusColor(model.status || "ready"))}>
                  {model.status || "ready"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-4 flex-1">
                {[
                  { label: "Task", value: model.task_type },
                  { label: "Classes", value: model.num_classes },
                  { label: "Framework", value: model.framework },
                  { label: "Created", value: formatRelativeTime(model.created_at) },
                ].map((m) => (
                  <div key={m.label} className="bg-muted rounded-lg px-3 py-2">
                    <p className="text-muted-foreground">{m.label}</p>
                    <p className="font-medium mt-0.5 truncate">{String(m.value)}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Link
                  href={`/models/${model.id}/playground`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all font-medium"
                >
                  <Zap className="w-3.5 h-3.5" /> Playground
                </Link>
                <button
                  onClick={() => deployMutation.mutate({ id: model.id, stage: "production" })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-muted hover:bg-emerald-500/10 hover:text-emerald-500 transition-all"
                >
                  <Rocket className="w-3.5 h-3.5" /> Deploy
                </button>
                <Link href={`/models/${model.id}`} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
