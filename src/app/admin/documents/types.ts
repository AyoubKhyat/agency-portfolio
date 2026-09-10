/** Shapes returned by the documents API — metadata only, never file bytes. */

export type AdminDocument = {
  id: string;
  title: string;
  clientName: string;
  clientId: string | null;
  projectName: string;
  projectId: string | null;
  type: string;
  language: string;
  status: string;
  documentDate: string | null;
  amount: number | null;
  currency: string;
  notes: string;
  fileName: string;
  fileSize: number;
  archivedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; companyName: string } | null;
  project: { id: string; name: string } | null;
};

export type ClientOption = { id: string; companyName: string };
export type ProjectOption = { id: string; name: string };
