"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { modelsApi } from "@/lib/api";
import { formatMs, formatPercent, getStatusColor, cn } from "@/lib/utils";
import {
  Sparkles, Zap, AlertCircle, Loader2, Copy, RotateCcw,
  Eye, ChevronDown, BarChart2,
} from "lucide-react";
import { toast } from "sonner";

const SAMPLE_TEXTS = [
  "I absolutely loved this product! The quality exceeded all my expectations and the service was outstanding.",
  "Terrible experience. The product broke after a week and customer support was completely unhelpful.",
  "The product is decent. Nothing spectacular but it does what it says it will do.",
  "This is by far the best investment I've made this year. Highly recommend to everyone!",
  "Disappointed with the purchase. Expected much better quality for the price.",
];

function ProbabilityBar({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color || "hsl(var(--primary))" }}
        />
      </div>
    </div>
  );
}

function TokenImportanceViz({ tokens }: { tokens: Array<{ token: string; importance: number }> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tokens.slice(0, 30).map((t, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded text-sm font-mono transition-all"
          style={{
            background: `hsl(262 83% 58% / ${t.importance * 0.7 + 0.05})`,
            color: t.importance > 0.5 ? "white" : "hsl(var(--foreground))",
          }}
          title={`${t.token}: ${(t.importance * 100).toFixed(1)}%`}
        >
          {t.token}
        </span>
      ))}
    </div>
  );
}

import { useParams } from "next/navigation";

export default function PlaygroundPage() {
  const urlParams = useParams();
  const modelId = (urlParams?.id as string) || "";
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [showExplain, setShowExplain] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: model } = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => modelsApi.get(modelId),
    enabled: Boolean(modelId),
  });

  const predictMutation = useMutation({
    mutationFn: (text: string) =>
      modelsApi.predict(modelId, { text, include_explanation: showExplain }),
    onSuccess: (data) => setResult(data),
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Prediction failed."),
  });

  const handlePredict = () => {
    if (!inputText.trim()) {
      toast.error("Please enter some text.");
      return;
    }
    predictMutation.mutate(inputText.trim());
  };

  const handleSample = (text: string) => {
    setInputText(text);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const SENTIMENT_COLORS: Record<string, string> = {
    positive: "#22c55e",
    negative: "#ef4444",
    neutral: "#f59e0b",
  };

  const getPredColor = (pred: string) =>
    SENTIMENT_COLORS[pred?.toLowerCase()] || "hsl(var(--primary))";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prediction Playground</h1>
            <p className="text-sm text-muted-foreground">
              {model?.name || "Loading model…"} · {model?.architecture?.toUpperCase()}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Input panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card rounded-xl border border-border p-6 space-y-4"
        >
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Input Text
          </h2>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter text to classify…&#10;&#10;Example: &quot;This product is absolutely amazing!&quot;"
            rows={6}
            className="w-full resize-none bg-muted border border-border rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{inputText.length} characters · {inputText.trim().split(/\s+/).filter(Boolean).length} words</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExplain}
                  onChange={(e) => setShowExplain(e.target.checked)}
                  className="rounded"
                />
                <span>Explain prediction</span>
              </label>
            </div>
          </div>

          {/* Sample texts */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Try a sample:</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_TEXTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSample(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-border transition-all"
                >
                  Sample {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePredict}
              disabled={predictMutation.isPending || !inputText.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {predictMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Predicting…</>
              ) : (
                <><Zap className="w-5 h-5" /> Predict</>
              )}
            </button>
            <button
              onClick={() => { setInputText(""); setResult(null); }}
              className="px-4 rounded-lg bg-muted hover:bg-muted/80 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Results panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card rounded-xl border border-border p-6 space-y-5"
        >
          <h2 className="font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Results
          </h2>

          <AnimatePresence mode="wait">
            {!result && !predictMutation.isPending && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-48 text-muted-foreground"
              >
                <Sparkles className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Run a prediction to see results</p>
              </motion.div>
            )}

            {predictMutation.isPending && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-48"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Running inference…</p>
              </motion.div>
            )}

            {result && !predictMutation.isPending && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Main prediction */}
                <div className="text-center p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Prediction</p>
                  <motion.p
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-bold capitalize mb-2"
                    style={{ color: getPredColor(result.prediction) }}
                  >
                    {result.prediction}
                  </motion.p>
                  <p className="text-2xl font-semibold text-muted-foreground">
                    {(result.confidence * 100).toFixed(1)}%
                  </p>
                </div>

                {/* Probability bars */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">All Classes</p>
                  {Object.entries(result.probabilities as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, prob]) => (
                      <ProbabilityBar
                        key={label}
                        label={label}
                        value={prob}
                        color={SENTIMENT_COLORS[label.toLowerCase()]}
                      />
                    ))}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Latency", value: formatMs(result.latency_ms) },
                    { label: "Tokens", value: result.token_count },
                    { label: "Model", value: result.model_type?.toUpperCase() },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted rounded-lg p-2.5">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-sm font-semibold mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Explainability */}
                {result.explanation?.token_importance && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Token Importance
                      <span className="text-xs text-muted-foreground">({result.explanation.method})</span>
                    </p>
                    <TokenImportanceViz tokens={result.explanation.token_importance} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
