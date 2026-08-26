"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiKeysApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import {
  Key, Plus, Copy, Check, Trash2, Code2, Terminal,
  ExternalLink, ShieldCheck, Zap, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [rateLimit, setRateLimit] = useState(60);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"curl" | "python" | "node">("python");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiKeysApi.create({
        name: keyName || "Production API Key",
        rate_limit_per_minute: rateLimit,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey(data.raw_key);
      setKeyName("");
      toast.success("API key generated!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to create API key.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked.");
    },
  });

  const codeSnippets = {
    python: `import requests

API_URL = "http://localhost:8000/api/v1/predict"
API_KEY = "${createdKey || "nt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"}"

payload = {
    "model_id": "bert-sentiment-v1",
    "text": "The platform architecture and throughput exceeded expectations.",
    "include_explanation": True
}

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.post(API_URL, json=payload, headers=headers)
result = response.json()

print(f"Prediction: {result['prediction']}")
print(f"Confidence: {result['confidence']:.2%}")
print(f"Latency: {result['latency_ms']}ms")`,

    curl: `curl -X POST "http://localhost:8000/api/v1/predict" \\
  -H "Authorization: Bearer ${createdKey || "nt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "bert-sentiment-v1",
    "text": "The platform architecture and throughput exceeded expectations.",
    "include_explanation": true
  }'`,

    node: `const axios = require('axios');

async function classify() {
  const res = await axios.post('http://localhost:8000/api/v1/predict', {
    model_id: 'bert-sentiment-v1',
    text: 'The platform architecture and throughput exceeded expectations.',
    include_explanation: true
  }, {
    headers: {
      'Authorization': \`Bearer \${process.env.NEURALTEXT_API_KEY}\`,
      'Content-Type': 'application/json'
    }
  });

  console.log('Prediction:', res.data.prediction);
  console.log('Confidence:', (res.data.confidence * 100).toFixed(1) + '%');
}

classify();`
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Developer API Keys & SDKs</h1>
          <p className="text-muted-foreground mt-1">
            Generate and manage secret keys for authenticating production programmatic inference requests.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Create Secret Key
        </button>
      </motion.div>

      {/* Secret Key Revealed Alert */}
      {createdKey && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Save your API Key now
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-xs hover:underline"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs">
            Please copy this key and store it securely. For security reasons, it will not be displayed again.
          </p>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-border font-mono text-xs text-foreground select-all">
            <span className="flex-1 truncate">{createdKey}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
                setCopiedRaw(true);
                toast.success("API key copied!");
                setTimeout(() => setCopiedRaw(false), 2000);
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-sans font-semibold text-xs flex items-center gap-1 hover:opacity-90"
            >
              {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedRaw ? "Copied" : "Copy Key"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold">Generate Secret API Key</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Key Identifier Name</label>
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Mobile App Backend"
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Rate Limit (Requests / Minute)</label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(+e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-border rounded-xl font-medium hover:bg-muted text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  createMutation.mutate();
                  setShowCreate(false);
                }}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 text-sm"
              >
                Generate Key
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Active Keys List */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Active API Credentials
          </h2>
          <span className="text-xs text-muted-foreground">{keys.length} keys active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider text-left">
                <th className="px-5 py-3 font-semibold">Key Name</th>
                <th className="px-5 py-3 font-semibold">Key Prefix</th>
                <th className="px-5 py-3 font-semibold">Rate Limit</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold">Last Used</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                    No active API keys found. Click &quot;Create Secret Key&quot; above to create one.
                  </td>
                </tr>
              ) : (
                keys.map((k: any) => (
                  <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">{k.name}</td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{k.key_prefix}</td>
                    <td className="px-5 py-4 font-mono text-xs">{k.rate_limit_per_minute} req/min</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatRelativeTime(k.created_at)}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {k.last_used_at ? formatRelativeTime(k.last_used_at) : "Never"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => revokeMutation.mutate(k.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Revoke API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Code Integration Examples */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">Client SDK Code Snippets</h2>
          </div>
          <div className="flex bg-muted p-1 rounded-xl">
            {(["python", "curl", "node"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSnippetTab(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                  activeSnippetTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "node" ? "Node.js" : tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-xl bg-muted/60 border border-border text-xs font-mono overflow-x-auto text-foreground leading-relaxed">
            <code>{codeSnippets[activeSnippetTab]}</code>
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(codeSnippets[activeSnippetTab]);
              toast.success("Code snippet copied!");
            }}
            className="absolute top-3 right-3 p-2 rounded-lg bg-background/80 hover:bg-background border border-border text-muted-foreground hover:text-foreground transition-all"
            title="Copy Code"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
