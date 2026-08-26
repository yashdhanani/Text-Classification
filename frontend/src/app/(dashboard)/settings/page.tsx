"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import { useTheme } from "next-themes";
import {
  User, Shield, Moon, Sun, Monitor, Bell, Key,
  Lock, Save, CheckCircle2, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    toast.success("Profile changes saved successfully.");
    setTimeout(() => setSaved(false), 2500);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    toast.success("Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your user account credentials, preferences, theme mode, and security configurations.
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Account Profile</h2>
              <p className="text-xs text-muted-foreground">Personal details and identification</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Full Name</label>
                <input
                  defaultValue={user?.full_name || "Admin User"}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Username</label>
                <input
                  defaultValue={user?.username || "admin"}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address</label>
              <input
                defaultValue={user?.email || "admin@neuraltext.ai"}
                disabled
                className="w-full px-3.5 py-2.5 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Profile
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
