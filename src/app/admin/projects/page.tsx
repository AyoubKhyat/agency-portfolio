"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus, Eye, EyeOff, Pencil, Trash2, ExternalLink, FolderKanban, LayoutGrid, List } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  slug: string;
  category: string;
  url: string;
  image: string;
  tag: string;
  visible: boolean;
  sortOrder: number;
  translations: { locale: string; title: string; desc: string }[];
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((data) => { if (data) setProjects(data); setLoading(false); });
  }, [router]);

  async function handleToggle(id: string) {
    const res = await fetch(`/api/admin/projects/${id}`, { method: "PATCH" });
    if (res.ok) {
      const updated = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, visible: updated.visible } : p)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
    if (res.ok) setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Portfolio" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="os-skeleton h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Portfolio"
        count={projects.length}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-50/80 border border-[var(--os-border)] rounded-lg p-0.5">
              <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-purple-50 text-purple-600" : "text-gray-500 hover:text-gray-800")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-purple-50 text-purple-600" : "text-gray-500 hover:text-gray-800")}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <Link href="/admin/projects/new" className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New Project
            </Link>
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-6 h-6" />}
          title="No projects yet"
          description="Create your first portfolio project."
          action={
            <Link href="/admin/projects/new" className="text-sm text-purple-600 hover:text-purple-600">
              Create project
            </Link>
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="group relative rounded-2xl border border-[var(--os-border)] bg-white/80 overflow-hidden hover:border-[var(--os-border-hover)] transition-all duration-200"
            >
              {/* Image */}
              <div className="relative aspect-[16/10] bg-[var(--os-surface-2)] overflow-hidden">
                {project.image && project.image.startsWith("/") ? (
                  <Image src={project.image} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="400px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <FolderKanban className="w-8 h-8" />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => handleToggle(project.id)} className="p-2 rounded-lg bg-white/90 backdrop-blur-sm text-gray-900 hover:bg-black/80 transition-colors">
                    {project.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <Link href={`/admin/projects/${project.id}/edit`} className="p-2 rounded-lg bg-white/90 backdrop-blur-sm text-gray-900 hover:bg-black/80 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  {project.url && (
                    <a href={project.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/90 backdrop-blur-sm text-gray-900 hover:bg-black/80 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => handleDelete(project.id)} className="p-2 rounded-lg bg-white/90 backdrop-blur-sm text-red-600 hover:bg-red-500/30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Visibility indicator */}
                {!project.visible && (
                  <div className="absolute top-3 left-3">
                    <Badge variant="default" size="sm">Hidden</Badge>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-gray-900 truncate">
                      {project.translations[0]?.title ?? project.slug}
                    </h3>
                    <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                      {project.translations[0]?.desc?.slice(0, 60)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="purple" size="sm">{project.category}</Badge>
                  {project.tag && <Badge variant="default" size="sm">{project.tag}</Badge>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List view - existing table style */
        <div className="border border-[var(--os-border)] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--os-border)] bg-gray-50/80">
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Image</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Title</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Category</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">Visible</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-[var(--os-border)] hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-12 h-8 relative rounded overflow-hidden bg-[var(--os-surface-2)]">
                      {project.image && project.image.startsWith("/") && (
                        <Image src={project.image} alt="" fill className="object-cover" sizes="48px" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{project.translations[0]?.title ?? project.slug}</td>
                  <td className="px-4 py-3"><Badge variant="purple" size="sm">{project.category}</Badge></td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(project.id)} className="transition-colors">
                      {project.visible ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/projects/${project.id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-purple-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => handleDelete(project.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
