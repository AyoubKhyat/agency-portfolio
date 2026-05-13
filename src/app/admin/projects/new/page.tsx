"use client";

import ProjectForm from "../ProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100 mb-8">New Project</h1>
      <ProjectForm mode="create" />
    </div>
  );
}
