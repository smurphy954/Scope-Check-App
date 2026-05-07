import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import {
  type Document,
  DOCUMENT_TYPE_LABEL_SINGULAR,
} from "@/lib/documents/types";
import { DocumentDetail } from "./document-detail";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: { projectId: string; documentId: string };
}) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select(
      "id, project_id, type, filename, storage_path, mime_type, file_size, page_count, extraction_status, extraction_error, extraction_started_at, extraction_completed_at, created_at",
    )
    .eq("id", params.documentId)
    .eq("project_id", params.projectId)
    .maybeSingle<Document>();
  if (!doc) notFound();

  const [{ data: requirements }, { data: products }] = await Promise.all([
    supabase
      .from("requirements")
      .select(
        "id, requirement_text, room_alias, trade, source_page, source_sheet, source_detail",
      )
      .eq("document_id", doc.id)
      .order("source_page", { ascending: true, nullsFirst: false }),
    supabase
      .from("submittal_products")
      .select(
        "id, product, manufacturer, model, spec_section, install_requirements, room_alias",
      )
      .eq("document_id", doc.id),
  ]);

  return (
    <main className="min-h-dvh">
      <AppHeader
        title={DOCUMENT_TYPE_LABEL_SINGULAR[doc.type]}
        back={{
          href: `/projects/${doc.project_id}/documents`,
          label: "Documents",
        }}
      />
      <DocumentDetail
        doc={doc}
        initialRequirements={requirements ?? []}
        initialProducts={products ?? []}
      />
    </main>
  );
}
