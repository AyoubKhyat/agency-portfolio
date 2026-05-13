"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ProjectForm from "../../ProjectForm";

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<null | Record<string, unknown>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/projects/${id}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 404) { router.push("/admin/projects"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setProject(data); setLoading(false); });
  }, [id, router]);

  if (loading) return <div className="text-gray-500 animate-pulse">Loading...</div>;
  if (!project) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100 mb-8">Edit Project</h1>
      <ProjectForm
        mode="edit"
        initial={project as unknown as Parameters<typeof ProjectForm>[0]["initial"]}
      />
    </div>
  );
}
