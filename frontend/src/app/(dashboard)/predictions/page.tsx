"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { modelsApi, predictApi } from "@/lib/api";
import { formatMs, cn } from "@/lib/utils";
import {
  Sparkles, Zap, RotateCcw, Copy, Check, Eye, AlertCircle,
  Loader2, ArrowRight, BarChart2, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

const SAMPLE_TEXTS = [
  "This new AI tool revolutionized our engineering pipeline! Accuracy is through the roof.",
  "Extremely disappointed. The service has been down three times this week with zero communication.",
  "The system operates within standard parameters. Latency is acceptable for our use case.",
  "Financial results for Q3 show a 24% increase in net recurring enterprise revenue.",
  "Security alert: Multiple suspicious login attempts detected from unauthorized IP addresses."
];

export default function PredictionsPage() {
  const [inputText, setInputText] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [includeExplain, setIncludeExplain] = useState(true);
  const [copied, setCopied] = useState(false);

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list(),
  });

  const predictMutation = useMutation({
    mutationFn: (text: string) => {
      const targetModel = selectedModel || (models[0]?.id as string);
      return predictApi.predict({
        model_id: targetModel,
        text,
        include_explanation: includeExplain,
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail?.message || err?.response?.data?.detail || "Inference failed.");
    },
  });

  const handlePredict = () => {
    if (!inputText.trim()) {
      toast.error("Please enter some text to classify.");
      return;
    }
    predictMutation.mutate(inputText.trim());
  };

  const handleCopyJson = () => {
    if (!predictMutation.data) return;
    navigator.clipboard.writeText(JSON.stringify(predictMutation.data, null, 2));
    setCopied(true);
    toast.success("JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeModelId = selectedModel || (models[0]?.id as string) || "";
  const activeModel = models.find((m: any) => m.id === activeModelId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Inference & Predictions</h1>
        <p className="text-muted-foreground mt-1">
          Test real-time predictions with confidence scores, full probability distributions, and explainability.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Input & Config Column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-6 space-y-5"
        >
          <div className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Inference Input
              </h2>
              {models.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Model:</span>
                  <select
                    value={activeModelId}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-3 py-1.5 bg-muted rounded-lg border border-border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {models.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.architecture?.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Text for Classification
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste any customer review, document excerpt, support ticket, or article..."
                rows={7}
                className="w-full resize-none bg-muted/60 border border-border rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span>{inputText.length} chars · {inputText.trim().split(/\s+/).filter(Boolean).length} words</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeExplain}
                    onChange={(e) => setIncludeExplain(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary/50"
                  />
                  <span>Generate Token Attribution</span>
                </label>
              </div>
            </div>

            {/* Quick Samples */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Preset Samples:</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TEXTS.map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => setInputText(sample)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-all text-left max-w-full truncate"
                  >
                    Preset {i + 1}: {sample.slice(0, 32)}…
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePredict}
                disabled={predictMutation.isPending || !inputText.trim()}
                className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {predictMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Executing Neural Forward Pass…
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Run Classification
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setInputText("");
                  predictMutation.reset();
                }}
                className="px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-all text-muted-foreground hover:text-foreground"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Output Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-6 space-y-5"
        >
          <div className="bg-card border border-border rounded-xl p-6 min-h-[460px] flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary" />
                  Prediction Intelligence
                </h2>
                {predictMutation.data && (
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy JSON"}
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {!predictMutation.data && !predictMutation.isPending && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 opacity-40 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground text-base">Awaiting Inference Task</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Select a model, enter or choose sample text, and trigger prediction to see real-time classification results.
                    </p>
                  </motion.div>
                )}

                {predictMutation.isPending && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-20"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    </div>
                    <p className="mt-4 text-sm font-medium">Computing softmax output & token saliency…</p>
                  </motion.div>
                )}

                {predictMutation.data && !predictMutation.isPending && (
                  <motion.div
                    key="data"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Top Result Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 text-center relative overflow-hidden">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Predicted Class</p>
                      <h3 className="text-4xl font-extrabold capitalize text-foreground mt-2 mb-1 tracking-tight">
                        {predictMutation.data.prediction}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {(predictMutation.data.confidence * 100).toFixed(1)}% Confidence
                      </div>
                    </div>

                    {/* Probability Distribution */}
                    {predictMutation.data.probabilities && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class Probabilities</p>
                        <div className="space-y-2.5">
                          {Object.entries(predictMutation.data.probabilities as Record<string, number>)
                            .sort(([, a], [, b]) => b - a)
                            .map(([cls, prob]) => (
                              <div key={cls} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="capitalize">{cls}</span>
                                  <span className="tabular-nums font-mono text-muted-foreground">{(prob * 100).toFixed(2)}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${prob * 100}%` }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Explainability / Token Highlights */}
                    {predictMutation.data.explanation?.token_importance && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-primary" /> Token Salience ({predictMutation.data.explanation.method})
                          </p>
                          <span className="text-[11px] text-muted-foreground">Higher opacity = higher attribution</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/40 border border-border max-h-36 overflow-y-auto">
                          {predictMutation.data.explanation.token_importance.map((t: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-xs font-mono transition-all"
                              style={{
                                backgroundColor: `hsl(262 83% 58% / ${Math.min(1, t.importance * 0.8 + 0.1)})`,
                                color: t.importance > 0.4 ? "#ffffff" : "inherit",
                              }}
                              title={`Token: "${t.token}" | Importance: ${(t.importance * 100).toFixed(1)}%`}
                            >
                              {t.token}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Latency & Telemetry Footer */}
            {predictMutation.data && (
              <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Inference Latency: <strong className="text-foreground font-mono">{formatMs(predictMutation.data.latency_ms)}</strong></span>
                <span>Architecture: <strong className="text-foreground">{activeModel?.architecture?.toUpperCase() || "NEURAL"}</strong></span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
