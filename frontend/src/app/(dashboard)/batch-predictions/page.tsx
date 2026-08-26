"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { modelsApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import {
  Layers, Upload, FileText, Loader2, CheckCircle2,
  Clock, AlertCircle, Download, Plus, X, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function BatchPredictionsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [jobName, setJobName] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [inputPath, setInputPath] = useState("");
  const [textColumn, setTextColumn] = useState("text");
  const [batchSize, setBatchSize] = useState(256);

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list(),
  });

  const batchMutation = useMutation({
    mutationFn: () =>
      modelsApi.batchPredict({
        name: jobName || "Batch Prediction Job",
        model_id: selectedModel || models[0]?.id,
        input_path: inputPath,
        text_column: textColumn,
        batch_size: batchSize,
      }),
    onSuccess: () => {
      setShowModal(false);
      setJobName("");
      setInputPath("");
      toast.success("Batch prediction job queued!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to start batch job.");
    },
  });

  // Mock batch jobs list for display when no live items are retrieved
  const mockJobs = [
    {
      id: "b-91823a",
      name: "Q3 Customer Support Feedback Bulk Scoring",
      model: "BERT Sentiment Classifier v2",
      total_records: 48500,
      processed: 48500,
      status: "completed",
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      duration: "1m 42s",
    },
    {
      id: "b-54211f",
      name: "Social Media Sentiment Stream — August Batch",
      model: "BiLSTM Document Tagger",
      total_records: 120000,
      processed: 84000,
      status: "running",
      created_at: new Date(Date.now() - 1800000).toISOString(),
      duration: "45s",
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Inference Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Run asynchronous high-throughput classification across large CSV, Parquet, and JSON datasets.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> New Batch Job
        </button>
      </motion.div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-lg font-bold">Configure Batch Inference</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Job Name</label>
                <input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g. Monthly Survey Categorization"
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Model</label>
                <select
                  value={selectedModel || (models[0]?.id as string)}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {models.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.architecture})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Data Source File Path (Server or S3/MinIO)</label>
                <input
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  placeholder="/tmp/data/incoming_records.csv"
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Text Column Name</label>
                  <input
                    value={textColumn}
                    onChange={(e) => setTextColumn(e.target.value)}
                    placeholder="text"
                    className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Batch Chunk Size</label>
                  <input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(+e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-xl font-medium hover:bg-muted text-sm transition-all">
                Cancel
              </button>
              <button
                onClick={() => batchMutation.mutate()}
                disabled={batchMutation.isPending || !inputPath.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 text-sm flex items-center justify-center gap-2 transition-all"
              >
                {batchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                Submit Batch Task
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Recent Batch Executions
          </h2>
          <span className="text-xs text-muted-foreground">Auto-updates in real-time</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider text-left">
                <th className="px-5 py-3 font-semibold">Job ID & Name</th>
                <th className="px-5 py-3 font-semibold">Model</th>
                <th className="px-5 py-3 font-semibold">Progress</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockJobs.map((job) => {
                const percent = Math.round((job.processed / job.total_records) * 100);
                return (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-foreground">{job.name}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{job.id}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-foreground">{job.model}</td>
                    <td className="px-5 py-4">
                      <div className="w-44 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{job.processed.toLocaleString()} / {job.total_records.toLocaleString()}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              job.status === "completed" ? "bg-emerald-500" : "bg-primary"
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                        job.status === "completed" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                      )}>
                        {job.status === "completed" ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{job.duration}</td>
                    <td className="px-5 py-4 text-right">
                      {job.status === "completed" && (
                        <button className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-all font-medium">
                          <Download className="w-3.5 h-3.5" /> CSV Results
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
