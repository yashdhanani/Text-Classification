"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setSubmitted(true);
      toast.success("Password reset instructions sent!");
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">NeuralText</span>
        </div>

        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <MailCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              If an account matches that email, we have sent a secure password reset link.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline pt-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign in
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-2">Reset Password</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your account email to receive a password reset link.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-muted rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign in
                </Link>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
