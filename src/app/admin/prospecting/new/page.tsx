"use client";

import ProspectForm from "../ProspectForm";

export default function NewProspectPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100 mb-8">New Prospect</h1>
      <ProspectForm mode="create" />
    </div>
  );
}
