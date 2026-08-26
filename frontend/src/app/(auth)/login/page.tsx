"use client";

import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi, tokenStorage } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      tokenStorage.setTokens(res.access_token, res.refresh_token);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950" />
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 50%, hsl(262 83% 58% / 0.4) 0%, transparent 60%),
                              radial-gradient(circle at 80% 20%, hsl(200 100% 60% / 0.3) 0%, transparent 50%)`,
          }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(hsl(0 0% 100% / 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(0 0% 100% / 0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-violet-300" />
              </div>
              <span className="text-2xl font-bold tracking-tight">NeuralText</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Train. Deploy.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300">
                Classify at scale.
              </span>
            </h1>
            <p className="text-white/60 text-lg max-w-md">
              Enterprise-grade NLP platform with BERT, LSTM, and transformer models.
              Real-time training, explainability, and production APIs.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-4">
              {[
                "Train BERT, DistilBERT, RoBERTa, LSTM models",
                "Real-time training progress & explainability",
                "Production REST API with rate limiting",
                "Model versioning & experiment tracking",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-white/80">
                  <div className="w-5 h-5 rounded-full bg-violet-500/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-violet-300" />
                  </div>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">NeuralText</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">Sign in</h2>
          <p className="text-muted-foreground mb-8">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Sign up free
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-sm font-medium">Password</label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-2">Demo credentials</p>
            <p className="text-xs text-foreground font-mono">admin@neuraltext.ai</p>
            <p className="text-xs text-foreground font-mono">admin123456</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
