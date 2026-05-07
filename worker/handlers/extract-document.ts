import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadDocument } from "../lib/storage.js";
import { extractDrawing } from "../extractors/drawing.js";
import { extractContract } from "../extractors/contract.js";
import { extractSubmittal } from "../extractors/submittal.js";

type DocumentRow = {
  id: string;
  project_id: string;
  type: "drawing" | "contract" | "submittal";
  storage_path: string;
  filename: string;
};

type Job = {
  id: string;
  payload: { document_id?: string };
};

export function makeExtractDocumentHandler(supabase: SupabaseClient) {
  return async function extractDocument(job: Job) {
    const documentId = job.payload?.document_id;
    if (!documentId) {
      throw new Error("extract_document job missing payload.document_id");
    }

    const { data: doc, error: loadErr } = await supabase
      .from("documents")
      .select("id, project_id, type, storage_path, filename")
      .eq("id", documentId)
      .maybeSingle<DocumentRow>();

    if (loadErr || !doc) {
      throw new Error(
        `document ${documentId} not found: ${loadErr?.message ?? "no row"}`,
      );
    }

    await supabase
      .from("documents")
      .update({
        extraction_status: "processing",
        extraction_started_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq("id", doc.id);

    try {
      const { buffer } = await downloadDocument(supabase, doc.storage_path);
      const summary = await runForType(supabase, doc, buffer);

      await supabase
        .from("documents")
        .update({
          extraction_status: "ready",
          extraction_completed_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("documents")
        .update({
          extraction_status: "failed",
          extraction_error: message.slice(0, 2000),
          extraction_completed_at: new Date().toISOString(),
        })
        .eq("id", doc.id);
      throw err;
    }
  };
}

async function runForType(
  supabase: SupabaseClient,
  doc: DocumentRow,
  buffer: Buffer,
) {
  // Re-runs: clear old findings for this document so we never double-count.
  if (doc.type === "drawing" || doc.type === "contract") {
    await supabase.from("requirements").delete().eq("document_id", doc.id);
  }
  if (doc.type === "submittal") {
    await supabase
      .from("submittal_products")
      .delete()
      .eq("document_id", doc.id);
  }

  if (doc.type === "drawing") {
    const { findings } = await extractDrawing(buffer);
    if (findings.length > 0) {
      const { error } = await supabase.from("requirements").insert(
        findings.map((f) => ({
          project_id: doc.project_id,
          document_id: doc.id,
          source: "drawing" as const,
          room_alias: f.room,
          trade: f.trade,
          requirement_text: f.requirement,
          source_page: f.page_number,
          source_sheet: f.source_sheet,
          source_detail: f.source_detail,
          raw: f,
        })),
      );
      if (error) throw new Error(`insert requirements: ${error.message}`);
    }
    return { kind: "drawing", count: findings.length };
  }

  if (doc.type === "contract") {
    const { scope } = await extractContract(buffer);
    if (scope.length > 0) {
      const { error } = await supabase.from("requirements").insert(
        scope.map((s) => ({
          project_id: doc.project_id,
          document_id: doc.id,
          source: "contract" as const,
          room_alias: s.room_or_area,
          trade: s.trade,
          requirement_text: s.scope_item,
          source_page: s.source_page,
          raw: s,
        })),
      );
      if (error) throw new Error(`insert requirements: ${error.message}`);
    }
    return { kind: "contract", count: scope.length };
  }

  // submittal
  const { products } = await extractSubmittal(buffer);
  if (products.length > 0) {
    const { error } = await supabase.from("submittal_products").insert(
      products.map((p) => ({
        project_id: doc.project_id,
        document_id: doc.id,
        product: p.product,
        manufacturer: p.manufacturer,
        model: p.model,
        spec_section: p.spec_section,
        install_requirements: p.install_requirements,
        room_alias: p.room_or_area,
        raw: p,
      })),
    );
    if (error) throw new Error(`insert submittal_products: ${error.message}`);
  }
  return { kind: "submittal", count: products.length };
}
