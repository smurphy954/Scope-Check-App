"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  MAX_FILE_SIZE,
  type DocumentType,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import { recordDocument } from "@/lib/documents/actions";

type UploadState =
  | { phase: "pending"; progress: 0 }
  | { phase: "uploading"; progress: number }
  | { phase: "recording"; progress: 100 }
  | { phase: "done"; progress: 100 }
  | { phase: "error"; progress: number; error: string };

type Item = {
  id: string;
  file: File;
  state: UploadState;
};

const ACCEPT = ALLOWED_MIME_TYPES.join(",");

export function UploadDialog({
  projectId,
  defaultType,
}: {
  projectId: string;
  defaultType: DocumentType;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType>(defaultType);
  const [items, setItems] = useState<Item[]>([]);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setItems([]);
    setType(defaultType);
  }

  function handleClose(next: boolean) {
    if (!next && items.some((i) => i.state.phase === "uploading")) return; // block close mid-upload
    setOpen(next);
    if (!next) reset();
  }

  function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newItems: Item[] = [];
    for (const file of Array.from(files)) {
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
        newItems.push({
          id: crypto.randomUUID(),
          file,
          state: {
            phase: "error",
            progress: 0,
            error: `Unsupported file type: ${file.type || "unknown"}`,
          },
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        newItems.push({
          id: crypto.randomUUID(),
          file,
          state: {
            phase: "error",
            progress: 0,
            error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; max is 25 MB.`,
          },
        });
        continue;
      }
      newItems.push({
        id: crypto.randomUUID(),
        file,
        state: { phase: "pending", progress: 0 },
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function uploadOne(item: Item) {
    const supabase = createClient();
    const documentId = item.id;
    const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${projectId}/${documentId}/${safeName}`;

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, state: { phase: "uploading", progress: 1 } }
          : i,
      ),
    );

    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, item.file, {
        contentType: item.file.type,
        upsert: false,
      });

    if (uploadErr) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                state: {
                  phase: "error",
                  progress: 0,
                  error: uploadErr.message,
                },
              }
            : i,
        ),
      );
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, state: { phase: "recording", progress: 100 } }
          : i,
      ),
    );

    const result = await recordDocument({
      documentId,
      projectId,
      type,
      filename: item.file.name,
      mimeType: item.file.type as (typeof ALLOWED_MIME_TYPES)[number],
      fileSize: item.file.size,
      storagePath,
    });

    if (result.error) {
      // Roll back the storage upload so we don't leave an orphan.
      await supabase.storage.from("documents").remove([storagePath]);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                state: {
                  phase: "error",
                  progress: 0,
                  error: result.error!,
                },
              }
            : i,
        ),
      );
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, state: { phase: "done", progress: 100 } }
          : i,
      ),
    );
  }

  function startUpload() {
    const ready = items.filter((i) => i.state.phase === "pending");
    if (ready.length === 0) return;
    startTransition(async () => {
      // Sequential uploads keep memory predictable on phones.
      for (const item of ready) {
        await uploadOne(item);
      }
      router.refresh();
    });
  }

  function closeWhenSafe() {
    const allDone =
      items.length > 0 &&
      items.every(
        (i) => i.state.phase === "done" || i.state.phase === "error",
      );
    if (allDone) handleClose(false);
  }

  const canUpload =
    !isPending &&
    items.some((i) => i.state.phase === "pending") &&
    !items.some((i) => i.state.phase === "uploading");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            PDF or image files. Up to 25 MB each. Claude will extract
            requirements after upload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              {DOCUMENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  disabled={isPending}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    type === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {DOCUMENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <label
            htmlFor="file-input"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Upload className="mb-2 h-6 w-6" />
            <p className="font-medium text-foreground">Choose files</p>
            <p>PDF, JPG, PNG, WEBP — up to 25 MB each</p>
            <input
              id="file-input"
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                onFilesPicked(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(item.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    {item.state.phase !== "uploading" &&
                      item.state.phase !== "recording" && (
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                  </div>
                  <div className="mt-2">
                    <Progress value={item.state.progress} />
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        item.state.phase === "error"
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {phaseLabel(item.state)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={closeWhenSafe}
            disabled={isPending}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={startUpload}
            disabled={!canUpload}
          >
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function phaseLabel(state: UploadState): string {
  switch (state.phase) {
    case "pending":
      return "Ready to upload";
    case "uploading":
      return "Uploading…";
    case "recording":
      return "Saving…";
    case "done":
      return "Uploaded — extraction queued";
    case "error":
      return state.error;
  }
}
