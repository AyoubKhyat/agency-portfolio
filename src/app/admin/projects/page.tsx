"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { HiOutlinePlus, HiOutlinePencilSquare, HiOutlineTrash, HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";

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

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
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

  if (loading) return <div className="text-gray-500 animate-pulse">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">Projects</h1>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4" /> New Project
        </Link>
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Image</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Slug</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Tag</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Visible</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="w-12 h-8 relative rounded overflow-hidden bg-white/10">
                    {project.image && project.image.startsWith("/") && (
                      <Image
                        src={project.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-200 font-medium">
                  {project.translations[0]?.title ?? project.slug}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{project.slug}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-300">{project.category}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{project.tag}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(project.id)} className="transition-colors">
                    {project.visible ? (
                      <HiOutlineEye className="w-5 h-5 text-green-400 hover:text-green-300" />
                    ) : (
                      <HiOutlineEyeSlash className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/projects/${project.id}/edit`}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-violet-400 transition-colors"
                    >
                      <HiOutlinePencilSquare className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No projects yet. Create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
