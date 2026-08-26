"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { trainingApi, createTrainingWebSocket } from "@/lib/api";
import { formatMs, getStatusColor, cn } from "@/lib/utils";
import {
  Activity, Clock, Cpu, AlertCircle, CheckCircle2,
  XCircle, TrendingDown, Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";

interface EpochLog {
  epoch: number;
  total_epochs: number;
  train_loss: number;
  val_loss: number;
  accuracy: number;
  f1: number;
  learning_rate: number;
  elapsed_seconds: number;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  running: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  queued: <Clock className="w-4 h-4 text-yellow-500" />,
  cancelled: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
};

export default function TrainingJobPage() {
  const urlParams = useParams();
  const jobId = (urlParams?.id as string) || "";
  const [liveLog, setLiveLog] = useState<EpochLog[]>([]);
  const [wsStatus, setWsStatus] = useState<string>("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  const { data: job, refetch } = useQuery({
    queryKey: ["training-job", jobId],
    queryFn: () => trainingApi.getJob(jobId),
    enabled: Boolean(jobId),
    refetchInterval: wsStatus === "closed" ? 5000 : false,
  });

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return;

    // Connect WebSocket for live updates
    const ws = createTrainingWebSocket(jobId, (data: any) => {
      if (data.type === "epoch") {
        setLiveLog((prev) => {
          const existing = prev.find((e) => e.epoch === data.epoch);
          if (existing) return prev.map((e) => (e.epoch === data.epoch ? data : e));
          return [...prev, data];
        });
      } else if (data.type === "completed") {
        setWsStatus("closed");
        refetch();
        toast.success("Training completed!");
      } else if (data.type === "failed") {
        setWsStatus("closed");
        refetch();
        toast.error(`Training failed: ${data.error}`);
      }
    });

    ws.onopen = () => setWsStatus("open");
    ws.onclose = () => setWsStatus("closed");
    ws.onerror = () => setWsStatus("error");
    wsRef.current = ws;

    return () => ws.close();
  }, [job?.status, jobId]);

  // Use DB training log if WS not live
  const chartData = liveLog.length > 0
    ? liveLog
    : (job?.training_log || []);

  const currentEpoch = liveLog.length > 0 ? Math.max(...liveLog.map((l) => l.epoch)) : (job?.current_epoch || 0);
  const totalEpochs = job?.total_epochs || 0;
  const progress = totalEpochs > 0 ? (currentEpoch / totalEpochs) * 100 : 0;
  const lastEpoch = chartData[chartData.length - 1];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{job?.name || "Training Job"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {job?.model_architecture?.toUpperCase()} · Job ID: {jobId.slice(0, 8)}…
            </p>
          </div>
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium", getStatusColor(job?.status || "queued"))}>
            {STATUS_ICONS[job?.status || "queued"]}
            {job?.status?.toUpperCase()}
          </div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Cpu className="w-4 h-4 text-primary" />
            Training Progress
          </div>
          <span className="text-sm text-muted-foreground">
            Epoch {currentEpoch} / {totalEpochs}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{progress.toFixed(1)}% complete</span>
          {lastEpoch && <span>{formatMs(lastEpoch.elapsed_seconds * 1000)} elapsed</span>}
        </div>
      </motion.div>

      {/* Metrics row */}
      {lastEpoch && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Train Loss", value: lastEpoch.train_loss?.toFixed(4), icon: TrendingDown, color: "text-orange-500" },
            { label: "Val Loss", value: lastEpoch.val_loss?.toFixed(4), icon: TrendingDown, color: "text-red-500" },
            { label: "Accuracy", value: `${(lastEpoch.accuracy * 100).toFixed(1)}%`, icon: CheckCircle2, color: "text-green-500" },
            { label: "F1 Score", value: `${(lastEpoch.f1 * 100).toFixed(1)}%`, icon: Activity, color: "text-blue-500" },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={cn("w-4 h-4", m.color)} />
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Loss curves */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <h3 className="font-semibold mb-4">Loss Curves</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Legend />
                <Line type="monotone" dataKey="train_loss" stroke="#f59e0b" strokeWidth={2} dot={false} name="Train Loss" />
                <Line type="monotone" dataKey="val_loss" stroke="#ef4444" strokeWidth={2} dot={false} name="Val Loss" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Accuracy & F1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <h3 className="font-semibold mb-4">Accuracy & F1</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(v: any) => `${((v || 0) * 100).toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#22c55e" strokeWidth={2} dot={false} name="Accuracy" />
                <Line type="monotone" dataKey="f1" stroke="#6366f1" strokeWidth={2} dot={false} name="F1 Score" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Empty state */}
      {chartData.length === 0 && job?.status === "queued" && (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          <Cpu className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Waiting for training to start…</p>
          <p className="text-sm mt-1">The worker is picking up your job.</p>
        </div>
      )}
    </div>
  );
}
