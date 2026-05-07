"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_TYPES,
  MAX_FILE_SIZE,
} from "./types";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

const RecordSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  type: z.enum(DOCUMENT_TYPES),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  storagePath: z.string().min(1),
});

// Called after the client has uploaded the file to Supabase Storage.
// Creates the documents row + enqueues an extract_document job.
export async function recordDocument(input: z.infer<typeof RecordSchema>) {
  const parsed = RecordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const {
    documentId,
    projectId,
    type,
    filename,
    mimeType,
    fileSize,
    storagePath,
  } = parsed.data;

  // Storage path must live under the project the user owns. Defense in depth
  // since storage RLS already enforces this.
  if (!storagePath.startsWith(`${projectId}/`)) {
    return { error: "Storage path doesn't match project." };
  }

  const { supabase, user } = await requireUser();

  // Confirm caller owns the project. RLS will also block if not, but a clear
  // error message is friendlier than a generic insert failure.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { error: insertErr } = await supabase.from("documents").insert({
    id: documentId,
    project_id: projectId,
    uploaded_by: user.id,
    type,
    filename,
    storage_path: storagePath,
    mime_type: mimeType,
    file_size: fileSize,
    extraction_status: "queued",
  });

  if (insertErr) {
    // If we orphaned a file, leave it for cleanup later. Returning the error
    // is more important than tidying.
    return { error: insertErr.message };
  }

  // jobs is server-managed (RLS locked to service_role). Use the admin
  // client so the user's session doesn't get rejected by RLS.
  const admin = createAdminClient();
  const { error: jobErr } = await admin.from("jobs").insert({
    kind: "extract_document",
    project_id: projectId,
    payload: { document_id: documentId },
  });

  if (jobErr) {
    // Roll back the documents row so we don't leave one stuck on 'queued'
    // forever with no job behind it.
    await supabase.from("documents").delete().eq("id", documentId);
    return { error: `extraction job not queued: ${jobErr.message}` };
  }

  revalidatePath(`/projects/${projectId}/documents`);
  return { ok: true, documentId };
}

const RerunSchema = z.object({ documentId: z.string().uuid() });

export async function rerunExtraction(documentId: string) {
  const parsed = RerunSchema.safeParse({ documentId });
  if (!parsed.success) return { error: "Invalid document id." };

  const { supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, project_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  await supabase
    .from("documents")
    .update({
      extraction_status: "queued",
      extraction_error: null,
      extraction_started_at: null,
      extraction_completed_at: null,
    })
    .eq("id", doc.id);

  const admin = createAdminClient();
  await admin.from("jobs").insert({
    kind: "extract_document",
    project_id: doc.project_id,
    payload: { document_id: doc.id },
  });

  revalidatePath(`/projects/${doc.project_id}/documents`);
  revalidatePath(`/projects/${doc.project_id}/documents/${doc.id}`);
  return { ok: true };
}

export async function deleteDocument(documentId: string) {
  const { supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, project_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  // Best-effort: remove the file too. Even if the storage delete fails, the
  // row removal is what matters for the UI; the file becomes orphaned and
  // can be swept up later.
  await supabase.storage.from("documents").remove([doc.storage_path]);

  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${doc.project_id}/documents`);
  return { ok: true };
}
