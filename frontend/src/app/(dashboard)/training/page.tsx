"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { trainingApi, projectsApi, datasetsApi } from "@/lib/api";
import { formatRelativeTime, getStatusColor, cn } from "@/lib/utils";
import {
  Plus, Cpu, Loader2, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronRight, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const ARCHITECTURES = [
  { value: "lstm", label: "LSTM", description: "Fast, works well with short texts" },
  { value: "bilstm", label: "BiLSTM", description: "Bidirectional + attention mechanism" },
  { value: "cnn_lstm", label: "CNN-LSTM", description: "Combines local feature extraction with sequence modeling" },
  { value: "transformer", label: "Transformer", description: "BERT/DistilBERT — highest accuracy" },
];

const TRANSFORMER_MODELS = [
  "distilbert-base-uncased",
  "bert-base-uncased",
  "roberta-base",
  "albert-base-v2",
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  running: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  queued: <Clock className="w-4 h-4 text-yellow-500" />,
  cancelled: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
};

export default function TrainingPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState("");
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const [jobName, setJobName] = useState("");
  const [arch, setArch] = useState("bilstm");
  const [transformerModel, setTransformerModel] = useState("distilbert-base-uncased");
  const [epochs, setEpochs] = useState(10);
  const [batchSize, setBatchSize] = useState(32);
  const [lr, setLr] = useState(0.0002);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const projectList: any[] = Array.isArray(projects)
    ? projects
    : (projects as any)?.items || [];

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: () => trainingApi.listJobs(),
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      trainingApi.createJob({
        project_id: projectId,
        dataset_version_id: datasetVersionId,
        name: jobName || `${arch.toUpperCase()} Training`,
        model_architecture: arch,
        hyperparameters: {
          num_epochs: epochs,
          batch_size: batchSize,
          learning_rate: lr,
          transformer_model_name: arch === "transformer" ? transformerModel : undefined,
        },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["training-jobs"] });
      setShowCreate(false);
      toast.success("Training job queued!");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to create job."),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => trainingApi.cancelJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-jobs"] });
      toast.info("Job cancelled.");
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Jobs</h1>
          <p className="text-muted-foreground mt-1">Train and monitor NLP models in real-time.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" /> New Training Job
        </button>
      </motion.div>

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto text-foreground"
            >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Launch Training Job</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-5">
              {/* Architecture selection */}
              <div>
                <label className="text-sm font-medium block mb-2">Model Architecture</label>
                <div className="grid grid-cols-2 gap-3">
                  {ARCHITECTURES.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setArch(a.value)}
                      className={cn(
                        "text-left p-3 rounded-xl border transition-all",
                        arch === a.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <p className="font-semibold text-sm">{a.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {arch === "transformer" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Transformer Model</label>
                  <select
                    value={transformerModel}
                    onChange={(e) => setTransformerModel(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {TRANSFORMER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Project</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select project…</option>
                    {projectList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Job Name</label>
                  <input
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Auto-generated"
                    className="w-full px-4 py-2.5 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Epochs</label>
                  <input type="number" value={epochs} min={1} max={100} onChange={(e) => setEpochs(+e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Batch Size</label>
                  <input type="number" value={batchSize} min={8} max={256} onChange={(e) => setBatchSize(+e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Learning Rate</label>
                  <input type="number" value={lr} step={0.00001} min={0.00001} max={0.1} onChange={(e) => setLr(+e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!projectId || createMutation.isPending}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Launch Training
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Jobs list */}
      <div className="space-y-3">
        {isLoading
          ? [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border shimmer" />)
          : (jobs as any[]).length === 0
          ? (
            <div className="text-center py-24 text-muted-foreground">
              <Cpu className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No training jobs yet</p>
              <p className="text-sm mt-1">Launch your first training job to get started.</p>
            </div>
          )
          : (jobs as any[]).map((job: any, i: number) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-5 flex items-center gap-5"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate">{job.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">
                      {job.model_architecture?.toUpperCase()}
                    </span>
                  </div>
                  {job.status === "running" && (
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
                        style={{ width: `${job.progress || 0}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium", getStatusColor(job.status))}>
                    {STATUS_ICONS[job.status]}
                    {job.status}
                  </span>
                  <span className="text-xs text-muted-foreground hidden md:block">{formatRelativeTime(job.created_at)}</span>
                  <Link href={`/training/${job.id}`} className="p-2 hover:bg-muted rounded-lg transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                  {["running", "queued"].includes(job.status) && (
                    <button onClick={() => cancelMutation.mutate(job.id)} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
        }
      </div>
    </div>
  );
}
