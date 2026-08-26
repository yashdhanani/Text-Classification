"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import { useTheme } from "next-themes";
import {
  User, Shield, Moon, Sun, Monitor, Bell, Key,
  Lock, Save, CheckCircle2, AlertTriangle, Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
  });

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name?: string; current_password?: string; new_password?: string }) =>
      authApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile changes saved successfully.");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || "Failed to update profile";
      toast.error(msg);
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ full_name: fullName });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    updateProfileMutation.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("Password updated successfully.");
        },
      }
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal credentials, preferences, theme mode, and security configurations.
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center font-bold text-primary">
                {(user?.full_name || user?.username || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold text-base">Account Profile</h2>
                <p className="text-xs text-muted-foreground">Personal details and identification</p>
              </div>
            </div>
            {user?.role && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                {user.role.replace("_", " ")}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Username</label>
                <input
                  value={user?.username || ""}
                  disabled
                  placeholder="username"
                  className="w-full px-3.5 py-2.5 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address</label>
              <input
                value={user?.email || ""}
                disabled
                placeholder="user@example.com"
                className="w-full px-3.5 py-2.5 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </button>
          </form>
        </motion.div>

        {/* Theme Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Sun className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Interface Appearance</h2>
              <p className="text-xs text-muted-foreground">Select color theme for your workspace</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-md">
            {[
              { mode: "dark", label: "Dark Mode", icon: Moon },
              { mode: "light", label: "Light Mode", icon: Sun },
              { mode: "system", label: "System Sync", icon: Monitor },
            ].map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  theme === mode ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Security / Password */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Security & Authentication</h2>
              <p className="text-xs text-muted-foreground">Update password and token policies</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Key className="w-4 h-4" /> Change Password
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
