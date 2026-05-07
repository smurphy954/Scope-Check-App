import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import type { Document, DocumentType } from "@/lib/documents/types";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { DocumentsScreen } from "./documents-screen";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { type?: string };
}) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", params.projectId)
    .maybeSingle();
  if (!project) notFound();

  const activeType = (DOCUMENT_TYPES as readonly string[]).includes(
    searchParams.type ?? "",
  )
    ? (searchParams.type as DocumentType)
    : null;

  const query = supabase
    .from("documents")
    .select(
      "id, project_id, type, filename, storage_path, mime_type, file_size, page_count, extraction_status, extraction_error, extraction_started_at, extraction_completed_at, created_at",
    )
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const { data: documents } = activeType
    ? await query.eq("type", activeType)
    : await query;

  return (
    <main className="min-h-dvh">
      <AppHeader
        title="Documents"
        back={{ href: `/projects/${project.id}`, label: "Project" }}
      />
      <DocumentsScreen
        projectId={project.id}
        activeType={activeType}
        initialDocuments={(documents ?? []) as Document[]}
      />
    </main>
  );
}
