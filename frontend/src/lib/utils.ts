import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    completed: "text-green-500 bg-green-500/10",
    running: "text-blue-500 bg-blue-500/10",
    queued: "text-yellow-500 bg-yellow-500/10",
    pending: "text-yellow-500 bg-yellow-500/10",
    failed: "text-red-500 bg-red-500/10",
    cancelled: "text-muted-foreground bg-muted",
    ready: "text-green-500 bg-green-500/10",
    processing: "text-blue-500 bg-blue-500/10",
    production: "text-emerald-500 bg-emerald-500/10",
    staging: "text-orange-500 bg-orange-500/10",
    archived: "text-muted-foreground bg-muted",
  };
  return map[status.toLowerCase()] || "text-muted-foreground bg-muted";
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export const MODEL_ARCHITECTURE_LABELS: Record<string, string> = {
  lstm: "LSTM",
  bilstm: "BiLSTM",
  cnn_lstm: "CNN-LSTM",
  transformer: "Transformer",
  bert: "BERT",
  distilbert: "DistilBERT",
  roberta: "RoBERTa",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  sentiment: "Sentiment Analysis",
  classification: "Text Classification",
  multi_label: "Multi-Label Classification",
};
