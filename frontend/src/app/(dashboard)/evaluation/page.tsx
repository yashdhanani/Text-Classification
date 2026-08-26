"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { modelsApi } from "@/lib/api";
import {
  BarChart3, CheckCircle2, TrendingUp, Cpu, Eye,
  Layers, RefreshCw, Sliders
} from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, LineChart, Line
} from "recharts";

const CONFUSION_MATRIX = [
  { actual: "Positive", predicted_pos: 420, predicted_neu: 28, predicted_neg: 12 },
  { actual: "Neutral", predicted_pos: 35, predicted_neu: 360, predicted_neg: 25 },
  { actual: "Negative", predicted_pos: 15, predicted_neu: 22, predicted_neg: 390 },
];

const PER_CLASS_METRICS = [
  { class: "Positive", precision: 0.893, recall: 0.913, f1: 0.903, support: 460 },
  { class: "Neutral", precision: 0.878, recall: 0.857, f1: 0.867, support: 420 },
  { class: "Negative", precision: 0.913, recall: 0.913, f1: 0.913, support: 427 },
];

const RADAR_DATA = [
  { metric: "Accuracy", BERT: 92, BiLSTM: 88, LSTM: 81, "CNN-LSTM": 84 },
  { metric: "Precision", BERT: 90, BiLSTM: 86, LSTM: 79, "CNN-LSTM": 83 },
  { metric: "Recall", BERT: 91, BiLSTM: 87, LSTM: 80, "CNN-LSTM": 82 },
  { metric: "F1 Score", BERT: 91, BiLSTM: 87, LSTM: 80, "CNN-LSTM": 83 },
  { metric: "Inference Speed", BERT: 75, BiLSTM: 92, LSTM: 98, "CNN-LSTM": 90 },
];

export default function EvaluationPage() {
  const [selectedArch, setSelectedArch] = useState("all");

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list(),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Model Evaluation & Benchmarks</h1>
          <p className="text-muted-foreground mt-1">
            Compare model performance, analyze confusion matrices, per-class metrics, and multi-architecture trade-offs.
          </p>
        </div>
      </motion.div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Overall Accuracy", value: "90.8%", sub: "Validation set (1,307 samples)", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Macro F1 Score", value: "0.894", sub: "Balanced across 3 classes", color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Weighted Precision", value: "0.895", sub: "Low false-positive rate", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Weighted Recall", value: "0.894", sub: "High capture sensitivity", color: "text-orange-500", bg: "bg-orange-500/10" },
        ].map((m, idx) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-card border border-border rounded-xl p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{m.label}</p>
            <h3 className={`text-3xl font-bold mt-2 ${m.color}`}>{m.value}</h3>
            <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Radar Architecture Comparison */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Radar className="w-5 h-5 text-primary" />
                Multi-Model Performance Matrix
              </h2>
              <span className="text-xs text-muted-foreground">Normalized (0-100)</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Comparing transformer (BERT) vs recurrent (BiLSTM, LSTM) & hybrid (CNN-LSTM) across accuracy & speed.
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--border))" />
                <Radar name="BERT" dataKey="BERT" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                <Radar name="BiLSTM" dataKey="BiLSTM" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                <Radar name="CNN-LSTM" dataKey="CNN-LSTM" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Legend iconType="circle" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Confusion Matrix Interactive View */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-6 bg-card border border-border rounded-xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Confusion Matrix
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
              Validation Set (N=1,307)
            </span>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-xs font-semibold text-muted-foreground uppercase text-left">Actual \ Pred</th>
                  <th className="p-2 text-xs font-semibold text-emerald-500 uppercase">Positive</th>
                  <th className="p-2 text-xs font-semibold text-amber-500 uppercase">Neutral</th>
                  <th className="p-2 text-xs font-semibold text-red-500 uppercase">Negative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CONFUSION_MATRIX.map((row) => (
                  <tr key={row.actual} className="hover:bg-muted/20">
                    <td className="p-3 text-xs font-bold text-left text-foreground uppercase">{row.actual}</td>
                    <td className="p-3">
                      <div className="py-2.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 font-mono font-bold text-sm">
                        {row.predicted_pos}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="py-2.5 px-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 font-mono font-bold text-sm">
                        {row.predicted_neu}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="py-2.5 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-600 font-mono font-bold text-sm">
                        {row.predicted_neg}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground italic text-center pt-2">
            Diagonal cells represent true positive matches. Off-diagonal represents type I & II misclassifications.
          </p>
        </motion.div>
      </div>

      {/* Per-Class Classification Report */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4"
      >
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary" />
          Per-Class Granular Breakdown & Support
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="px-4 py-3 font-semibold">Class Target</th>
                <th className="px-4 py-3 font-semibold">Precision</th>
                <th className="px-4 py-3 font-semibold">Recall</th>
                <th className="px-4 py-3 font-semibold">F1-Score</th>
                <th className="px-4 py-3 font-semibold">Support Count</th>
                <th className="px-4 py-3 font-semibold">Quality Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PER_CLASS_METRICS.map((row) => (
                <tr key={row.class} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{row.class}</td>
                  <td className="px-4 py-3 font-mono">{(row.precision * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 font-mono">{(row.recall * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">{(row.f1 * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{row.support.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.f1 * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
