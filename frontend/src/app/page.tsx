"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap, Brain, BarChart3, Shield, Globe, ChevronRight,
  Sparkles, Database, Cpu, Box,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "Advanced NLP Models",
    description: "BERT, DistilBERT, RoBERTa, BiLSTM, CNN-LSTM — train and compare multiple architectures.",
    color: "from-violet-500/20 to-purple-500/20",
    border: "border-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Live training curves, confusion matrices, class distributions, and model performance dashboards.",
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: Sparkles,
    title: "Explainability",
    description: "SHAP-based token importance and attention visualization for every prediction.",
    color: "from-orange-500/20 to-amber-500/20",
    border: "border-orange-500/20",
    iconColor: "text-orange-400",
  },
  {
    icon: Database,
    title: "Dataset Management",
    description: "Upload CSV, JSON, Parquet, Excel. Auto-validate, preview, and stratified split datasets.",
    color: "from-emerald-500/20 to-green-500/20",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Globe,
    title: "Production APIs",
    description: "REST API with API key auth, rate limiting, batch predictions, and WebSocket streaming.",
    color: "from-pink-500/20 to-rose-500/20",
    border: "border-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "JWT + API key auth, RBAC, audit logs, request rate limiting, and input sanitization.",
    color: "from-indigo-500/20 to-blue-500/20",
    border: "border-indigo-500/20",
    iconColor: "text-indigo-400",
  },
];

const STATS = [
  { label: "Model Architectures", value: "6+" },
  { label: "Max Dataset Size", value: "500MB" },
  { label: "API Latency", value: "<50ms" },
  { label: "Batch Records", value: "1M+" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">NeuralText</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, hsl(262 83% 58%) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Enterprise-Grade AI/NLP Platform
            </div>

            <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-6">
              Text Classification
              <br />
              <span className="gradient-text">Reimagined</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Train BERT, LSTM, and transformer models. Deploy at scale. Get predictions with
              explainability — all from one world-class platform.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-95 transition-all text-lg"
              >
                Start for Free <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-border hover:bg-muted transition-all text-lg font-semibold"
              >
                View Demo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <p className="text-4xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Everything you need to ship NLP</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From raw data to production API in minutes. No infrastructure headaches.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  viewport={{ once: true }}
                  className={`relative p-6 rounded-2xl bg-gradient-to-br ${feat.color} border ${feat.border} card-lift`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${feat.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feat.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feat.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-16 border-t border-border px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wider">Built on best-in-class technology</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground">
            {["FastAPI", "Next.js 14", "PyTorch", "HuggingFace", "PostgreSQL", "Redis", "Celery", "MinIO"].map((t) => (
              <span key={t} className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:border-primary/50 hover:text-foreground transition-all">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-3xl border border-primary/20 p-16"
          >
            <h2 className="text-4xl font-bold mb-4">Ready to classify at scale?</h2>
            <p className="text-muted-foreground mb-8">
              Join teams building NLP products faster with NeuralText.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all"
            >
              Get started for free <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">NeuralText</span>
        </div>
        <p>© 2025 NeuralText. Enterprise AI/NLP Platform.</p>
      </footer>
    </div>
  );
}
