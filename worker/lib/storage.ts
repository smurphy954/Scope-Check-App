import type { SupabaseClient } from "@supabase/supabase-js";

export async function downloadDocument(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(storagePath);
  if (error || !data) {
    throw new Error(
      `Storage download failed for ${storagePath}: ${error?.message ?? "no data"}`,
    );
  }
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: data.type || "application/octet-stream",
  };
}
