"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ProspectForm from "../../ProspectForm";

export default function EditProspectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [prospect, setProspect] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/prospecting/${id}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 404) { router.push("/admin/prospecting"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setProspect(data); setLoading(false); });
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" />
      </div>
    );
  }
  if (!prospect) return null;

  return <ProspectForm mode="edit" initial={prospect} />;
}
