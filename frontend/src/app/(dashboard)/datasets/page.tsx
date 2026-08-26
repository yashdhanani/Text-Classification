"use client";

import { useState, useRef, useCallback } from "react";

/** Decode HTML entities (&#39; → ', &amp; → &, etc.) for display */
function decodeHtml(raw: unknown): string {
  const str = String(raw ?? "");
  if (!str || str === "nan") return "";
  try {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  } catch {
    return str;
  }
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { datasetsApi, projectsApi } from "@/lib/api";
import { formatBytes, formatRelativeTime, cn } from "@/lib/utils";
import {
  Upload, Database, FileText, Loader2, CheckCircle2,
  AlertCircle, Eye, BarChart2, GitBranch, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  ready: "text-green-500 bg-green-500/10",
  processing: "text-blue-500 bg-blue-500/10",
  error: "text-red-500 bg-red-500/10",
  uploading: "text-yellow-500 bg-yellow-500/10",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  ready: <CheckCircle2 className="w-4 h-4" />,
  processing: <Loader2 className="w-4 h-4 animate-spin" />,
  error: <AlertCircle className="w-4 h-4" />,
};

export default function DatasetsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const projectList: any[] = Array.isArray(projects)
    ? projects
    : (projects as any)?.items || [];

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetsApi.list(),
    refetchInterval: 10000,
  });

  const handleUpload = async (file: File, projectId: string) => {
    if (!projectId) {
      toast.error("Please select a project first.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("project_id", projectId);
    fd.append("name", file.name.replace(/\.[^.]+$/, ""));
    setUploading(true);
    try {
      await datasetsApi.upload(fd);
      qc.invalidateQueries({ queryKey: ["datasets"] });
      toast.success(`Dataset "${file.name}" uploaded!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const [selectedProjectId, setSelectedProjectId] = useState("");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file, selectedProjectId);
  };

  const loadPreview = async (dataset: any) => {
    setSelectedDataset(dataset);
    try {
      const data = await datasetsApi.preview(dataset.id, 10);
      setPreviewData(data);
    } catch {
      setPreviewData(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Datasets</h1>
        <p className="text-muted-foreground mt-1">Upload, validate, and split training datasets.</p>
      </motion.div>

      {/* Upload area */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.jsonl,.xlsx,.xls,.parquet,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file, selectedProjectId);
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="font-medium">Uploading…</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-1">Drop a file or click to browse</p>
              <p className="text-sm text-muted-foreground">
                CSV, JSON, JSONL, Excel, Parquet, TXT · Up to 500MB
              </p>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm font-medium flex-shrink-0">Project:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select project…</option>
            {projectList.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Dataset list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {isLoading
          ? [...Array(3)].map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-card border border-border shimmer" />
            ))
          : (datasets as any[]).map((ds: any, i: number) => (
              <motion.div
                key={ds.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5 card-lift group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Database className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold truncate max-w-[150px]">{ds.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {ds.file_format?.toUpperCase()} · {formatBytes(ds.file_size || 0)}
                      </p>
                    </div>
                  </div>
                  <span className={cn("flex items-center gap-1.5 text-xs px-2 py-1 rounded-full", STATUS_COLORS[ds.status] || "text-muted-foreground bg-muted")}>
                    {STATUS_ICONS[ds.status]}
                    {ds.status}
                  </span>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <button
                    onClick={() => loadPreview(ds)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    <GitBranch className="w-3.5 h-3.5" /> Split
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-right">{formatRelativeTime(ds.created_at)}</p>
              </motion.div>
            ))}
      </div>

      {/* Preview modal */}
      {selectedDataset && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-bold text-lg">{selectedDataset.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {previewData.rows?.length} rows preview · {previewData.columns?.length} columns
                </p>
              </div>
              <button onClick={() => setSelectedDataset(null)} className="p-2 rounded-lg hover:bg-muted transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    {previewData.columns?.map((col: string) => (
                      <th key={col} className="text-left px-4 py-3 text-muted-foreground font-medium border-b border-border whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows?.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      {previewData.columns?.map((col: string) => (
                        <td
                          key={col}
                          className="px-4 py-2.5 border-b border-border/50 max-w-[400px] truncate"
                          title={decodeHtml(row[col])}
                        >
                          {decodeHtml(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
