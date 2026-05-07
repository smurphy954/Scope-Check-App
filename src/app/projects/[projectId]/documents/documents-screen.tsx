"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type Document,
  type DocumentType,
  type ExtractionStatus,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import { ChevronRight, RotateCcw, Trash2, FileText } from "lucide-react";
import { UploadDialog } from "./upload-dialog";
import { rerunExtraction, deleteDocument } from "@/lib/documents/actions";

export function DocumentsScreen({
  projectId,
  activeType,
  initialDocuments,
}: {
  projectId: string;
  activeType: DocumentType | null;
  initialDocuments: Document[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);

  // Keep server-rendered list in sync if the URL filter changes.
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  // Realtime: subscribe to all changes on documents in this project.
  const supabaseRef = useRef(createClient());
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`documents-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setDocuments((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((d) => d.id !== (payload.old as Document).id);
            }
            const next = payload.new as Document;
            const idx = prev.findIndex((d) => d.id === next.id);
            if (idx === -1) return [next, ...prev];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const filtered = useMemo(
    () =>
      activeType ? documents.filter((d) => d.type === activeType) : documents,
    [documents, activeType],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <UploadDialog projectId={projectId} defaultType={activeType ?? "drawing"} />
      </div>

      <nav className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 whitespace-nowrap">
          <FilterTab
            href={`/projects/${projectId}/documents`}
            label="All"
            active={activeType === null}
          />
          {DOCUMENT_TYPES.map((t) => (
            <FilterTab
              key={t}
              href={`/projects/${projectId}/documents?type=${t}`}
              label={DOCUMENT_TYPE_LABEL[t]}
              active={activeType === t}
            />
          ))}
        </ul>
      </nav>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {filtered.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onRerun={async () => {
                await rerunExtraction(doc.id);
              }}
              onDelete={async () => {
                if (
                  !confirm(`Delete "${doc.filename}"? This can't be undone.`)
                ) {
                  return;
                }
                await deleteDocument(doc.id);
                router.refresh();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      No documents yet. Tap <span className="font-medium">Upload</span> to add
      drawings, contracts, or submittals — Claude will extract the requirements.
    </div>
  );
}

function DocumentRow({
  doc,
  onRerun,
  onDelete,
}: {
  doc: Document;
  onRerun: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"rerun" | "delete" | null>(null);

  return (
    <li className="flex items-stretch overflow-hidden rounded-lg border bg-card">
      <Link
        href={`/projects/${doc.project_id}/documents/${doc.id}`}
        className="flex flex-1 items-center gap-3 px-4 py-3 hover:bg-accent"
      >
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{doc.filename}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {DOCUMENT_TYPE_LABEL[doc.type]}
            </span>
            <StatusBadge status={doc.extraction_status} />
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
      <div className="flex flex-col border-l">
        <button
          type="button"
          aria-label="Re-run extraction"
          className="flex h-1/2 w-11 items-center justify-center text-muted-foreground hover:bg-accent disabled:opacity-50"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("rerun");
            try {
              await onRerun();
            } finally {
              setBusy(null);
            }
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Delete document"
          className="flex h-1/2 w-11 items-center justify-center border-t text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("delete");
            try {
              await onDelete();
            } finally {
              setBusy(null);
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export function StatusBadge({ status }: { status: ExtractionStatus }) {
  const map: Record<
    ExtractionStatus,
    { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
  > = {
    queued: { label: "Queued", variant: "secondary" },
    processing: { label: "Processing…", variant: "warning" },
    ready: { label: "Ready", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
