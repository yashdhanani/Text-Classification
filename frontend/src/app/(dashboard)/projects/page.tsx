"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { projectsApi } from "@/lib/api";
import { formatRelativeTime, getStatusColor, cn } from "@/lib/utils";
import {
  Plus, FolderOpen, Loader2, MoreHorizontal, Trash2,
  Edit, Sparkles, Database, Box,
} from "lucide-react";
import { toast } from "sonner";

const TASK_TYPES = [
  { value: "classification", label: "Text Classification" },
  { value: "sentiment", label: "Sentiment Analysis" },
  { value: "multi_label", label: "Multi-Label Classification" },
];

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTask, setNewTask] = useState("classification");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      projectsApi.create({ name: newName, description: newDesc, task_type: newTask }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      toast.success("Project created!");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to create project."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted.");
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Organize your NLP experiments by project.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </motion.div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl text-foreground"
          >
            <h2 className="text-xl font-bold mb-5">Create Project</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Project Name *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My NLP Project"
                  className="w-full px-4 py-3 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe your project..."
                  rows={3}
                  className="w-full px-4 py-3 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Task Type</label>
                <select
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  className="w-full px-4 py-3 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg border border-border hover:bg-muted transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => newName.trim() && createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Project grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-card border border-border shimmer" />
          ))}
        </div>
      ) : projects.items?.length === 0 || projects.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {(projects.items || projects).map((project: any, i: number) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-5 card-lift group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <button
                  onClick={() => deleteMutation.mutate(project.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-lg mb-1 truncate">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
              )}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border">
                  {project.task_type?.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
                <span>{formatRelativeTime(project.created_at)}</span>
                <a
                  href={`/projects/${project.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  Open →
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
