"use client";

import { use } from "react";
import { WorkspaceView } from "@/components/admin/workspace/workspace-view";

export default function ProspectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <WorkspaceView endpoint={`/api/admin/workspace/prospect/${id}`} />;
}
