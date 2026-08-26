"use client";

import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Zap, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { authApi, tokenStorage } from "@/lib/api";

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, _ and -"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

const passwordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const pw = watch("password", "");
  const strength = passwordStrength(pw);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      await authApi.register(data);
      const login = await authApi.login({ email: data.email, password: data.password });
      tokenStorage.setTokens(login.access_token, login.refresh_token);
      toast.success("Account created! Welcome to NeuralText.");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Registration failed. Please try again.";
      toast.error(msg);
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
        className="w-full max-w-lg"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold">NeuralText</span>
        </div>

        <h1 className="text-3xl font-bold mb-2">Create your account</h1>
        <p className="text-muted-foreground mb-8">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                {...register("full_name")}
                placeholder="Jane Smith"
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
              {errors.full_name && <p className="mt-1 text-sm text-destructive">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <input
                {...register("username")}
                placeholder="janedoe"
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
              {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                {...register("email")}
                type="email"
                placeholder="jane@example.com"
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
              {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPw ? "text" : "password"}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {pw && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i < strength ? strengthColors[strength - 1] : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pw ? strengthLabels[Math.max(0, strength - 1)] : ""}
                </p>
              </div>
            )}
            {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating account…</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Create Account</>
            )}
          </button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          By signing up, you agree to our{" "}
          <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
          {" "}and{" "}
          <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
