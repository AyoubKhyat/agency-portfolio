"use client";

import { use } from "react";
import { WorkspaceView } from "@/components/admin/workspace/workspace-view";

export default function DiscoveryWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <WorkspaceView endpoint={`/api/admin/workspace/discovery/${id}`} />;
}
