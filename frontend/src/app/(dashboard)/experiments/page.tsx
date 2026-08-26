"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { trainingApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import {
  FlaskConical, CheckCircle2, GitCompare, Filter,
  Sliders, ArrowUpRight, Cpu, Layers
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from "recharts";

const EXPERIMENT_RUNS = [
  {
    id: "exp-001",
    name: "BERT Base — lr=2e-5, wd=0.01",
    model: "BERT Transformer",
    val_accuracy: 0.924,
    val_loss: 0.218,
    epochs: 5,
    batch_size: 32,
    lr: "2e-5",
    optimizer: "AdamW",
    status: "best",
    date: "1 day ago"
  },
  {
    id: "exp-002",
    name: "DistilBERT — lr=3e-5, wd=0.01",
    model: "DistilBERT",
    val_accuracy: 0.912,
    val_loss: 0.245,
    epochs: 5,
    batch_size: 32,
    lr: "3e-5",
    optimizer: "AdamW",
    status: "completed",
    date: "2 days ago"
  },
  {
    id: "exp-003",
    name: "BiLSTM Attention — 256 hidden",
    model: "BiLSTM",
    val_accuracy: 0.884,
    val_loss: 0.312,
    epochs: 10,
    batch_size: 64,
    lr: "1e-3",
    optimizer: "Adam",
    status: "completed",
    date: "3 days ago"
  },
  {
    id: "exp-004",
    name: "CNN-LSTM Hybrid — Filter 128",
    model: "CNN-LSTM",
    val_accuracy: 0.856,
    val_loss: 0.364,
    epochs: 10,
    batch_size: 64,
    lr: "1e-3",
    optimizer: "Adam",
    status: "completed",
    date: "3 days ago"
  },
  {
    id: "exp-005",
    name: "Standard LSTM Baseline",
    model: "LSTM",
    val_accuracy: 0.812,
    val_loss: 0.445,
    epochs: 10,
    batch_size: 64,
    lr: "2e-3",
    optimizer: "Adam",
    status: "completed",
    date: "4 days ago"
  }
];

const COMPARISON_CURVES = [
  { epoch: 1, BERT: 0.82, DistilBERT: 0.79, BiLSTM: 0.71, "CNN-LSTM": 0.68, LSTM: 0.62 },
  { epoch: 2, BERT: 0.87, DistilBERT: 0.85, BiLSTM: 0.78, "CNN-LSTM": 0.75, LSTM: 0.69 },
  { epoch: 3, BERT: 0.90, DistilBERT: 0.88, BiLSTM: 0.83, "CNN-LSTM": 0.80, LSTM: 0.74 },
  { epoch: 4, BERT: 0.915, DistilBERT: 0.90, BiLSTM: 0.86, "CNN-LSTM": 0.83, LSTM: 0.78 },
  { epoch: 5, BERT: 0.924, DistilBERT: 0.912, BiLSTM: 0.884, "CNN-LSTM": 0.856, LSTM: 0.812 },
];

export default function ExperimentsPage() {
  const [selectedExperiments, setSelectedExperiments] = useState<string[]>(["exp-001", "exp-002", "exp-003"]);

  const toggleSelect = (id: string) => {
    if (selectedExperiments.includes(id)) {
      setSelectedExperiments(selectedExperiments.filter(x => x !== id));
    } else {
      setSelectedExperiments([...selectedExperiments, id]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Experiment Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Compare hyperparameter runs, loss convergence, and benchmark accuracy curves side-by-side.
          </p>
        </div>
      </motion.div>

      {/* Comparison Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            Validation Accuracy Convergence by Epoch
          </h2>
          <span className="text-xs text-muted-foreground">Multi-run comparison</span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={COMPARISON_CURVES}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="epoch" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis domain={[0.6, 1.0]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(v: any) => `${((v || 0) * 100).toFixed(1)}%`}
              />
              <Legend />
              <Line type="monotone" dataKey="BERT" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="DistilBERT" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="BiLSTM" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="CNN-LSTM" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="LSTM" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Runs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Tracked Experiment Runs ({EXPERIMENT_RUNS.length})
          </h2>
          <span className="text-xs text-muted-foreground">Select runs to compare</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider text-left">
                <th className="px-4 py-3 font-semibold">Select</th>
                <th className="px-4 py-3 font-semibold">Run / Architecture</th>
                <th className="px-4 py-3 font-semibold">Val Accuracy</th>
                <th className="px-4 py-3 font-semibold">Val Loss</th>
                <th className="px-4 py-3 font-semibold">Learning Rate</th>
                <th className="px-4 py-3 font-semibold">Batch Size</th>
                <th className="px-4 py-3 font-semibold">Optimizer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EXPERIMENT_RUNS.map((run) => {
                const selected = selectedExperiments.includes(run.id);
                return (
                  <tr key={run.id} className={cn("hover:bg-muted/30 transition-colors", selected && "bg-primary/5")}>
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(run.id)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-foreground">{run.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{run.id} · {run.model}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-500">
                      {(run.val_accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">{run.val_loss.toFixed(3)}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{run.lr}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{run.batch_size}</td>
                    <td className="px-4 py-3.5 text-xs font-medium">{run.optimizer}</td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold",
                        run.status === "best" ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" : "bg-muted text-muted-foreground"
                      )}>
                        {run.status === "best" ? "👑 Best Model" : "Completed"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
