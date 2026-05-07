"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  type Document,
  DOCUMENT_TYPE_LABEL_SINGULAR,
} from "@/lib/documents/types";
import { rerunExtraction } from "@/lib/documents/actions";
import { StatusBadge } from "../documents-screen";

type Requirement = {
  id: string;
  requirement_text: string;
  room_alias: string | null;
  trade: string | null;
  source_page: number | null;
  source_sheet: string | null;
  source_detail: string | null;
};

type Product = {
  id: string;
  product: string | null;
  manufacturer: string | null;
  model: string | null;
  spec_section: string | null;
  install_requirements: string | null;
  room_alias: string | null;
};

export function DocumentDetail({
  doc: initialDoc,
  initialRequirements,
  initialProducts,
}: {
  doc: Document;
  initialRequirements: Requirement[];
  initialProducts: Product[];
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<Document>(initialDoc);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [products, setProducts] = useState(initialProducts);
  const [isRerunning, startRerun] = useTransition();

  // Realtime: subscribe to the doc's status changes so the detail page
  // updates as the worker progresses. When status flips to ready, refresh
  // the requirements/products from the server.
  const supabaseRef = useRef(createClient());
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`document-${doc.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "documents",
          filter: `id=eq.${doc.id}`,
        },
        async (payload) => {
          const next = payload.new as Document;
          setDoc(next);
          if (next.extraction_status === "ready") {
            // Pull fresh extracted findings.
            const [{ data: req }, { data: prod }] = await Promise.all([
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
            setRequirements((req ?? []) as Requirement[]);
            setProducts((prod ?? []) as Product[]);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [doc.id]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <section className="rounded-lg border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {DOCUMENT_TYPE_LABEL_SINGULAR[doc.type]}
        </p>
        <p className="mt-1 break-words text-base font-medium">{doc.filename}</p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={doc.extraction_status} />
          <span className="text-xs text-muted-foreground">
            {(doc.file_size / 1024 / 1024).toFixed(1)} MB
            {doc.page_count ? ` · ${doc.page_count} pages` : ""}
          </span>
        </div>
        {doc.extraction_status === "failed" && doc.extraction_error && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {doc.extraction_error}
          </p>
        )}
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRerunning || doc.extraction_status === "queued" || doc.extraction_status === "processing"}
            onClick={() =>
              startRerun(async () => {
                await rerunExtraction(doc.id);
                router.refresh();
              })
            }
          >
            <RotateCcw className="h-4 w-4" />
            Re-run extraction
          </Button>
        </div>
      </section>

      {doc.type === "submittal" ? (
        <ProductsList products={products} status={doc.extraction_status} />
      ) : (
        <RequirementsList
          requirements={requirements}
          status={doc.extraction_status}
        />
      )}
    </div>
  );
}

function PendingState({ status }: { status: Document["extraction_status"] }) {
  if (status === "ready") {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No findings extracted from this document.
      </p>
    );
  }
  if (status === "failed") return null;
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {status === "processing"
        ? "Claude is reading this document — findings will appear here when ready."
        : "Queued for extraction. Hold tight."}
    </p>
  );
}

function RequirementsList({
  requirements,
  status,
}: {
  requirements: Requirement[];
  status: Document["extraction_status"];
}) {
  if (requirements.length === 0) return <PendingState status={status} />;
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        {requirements.length} requirement
        {requirements.length === 1 ? "" : "s"} extracted
      </p>
      <ul className="space-y-2">
        {requirements.map((r) => (
          <li key={r.id} className="rounded-md border bg-card p-3">
            <p className="text-sm">{r.requirement_text}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {r.room_alias && (
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {r.room_alias}
                </span>
              )}
              {r.trade && (
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {r.trade}
                </span>
              )}
              {r.source_sheet && <span>Sheet {r.source_sheet}</span>}
              {r.source_detail && <span>Detail {r.source_detail}</span>}
              {r.source_page != null && <span>Page {r.source_page}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductsList({
  products,
  status,
}: {
  products: Product[];
  status: Document["extraction_status"];
}) {
  if (products.length === 0) return <PendingState status={status} />;
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        {products.length} product{products.length === 1 ? "" : "s"} extracted
      </p>
      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="rounded-md border bg-card p-3">
            <p className="text-sm font-medium">
              {p.product ?? "Unnamed product"}
            </p>
            <dl className="mt-2 space-y-1 text-xs">
              {p.manufacturer && (
                <Field label="Manufacturer" value={p.manufacturer} />
              )}
              {p.model && <Field label="Model" value={p.model} />}
              {p.spec_section && (
                <Field label="Spec section" value={p.spec_section} />
              )}
              {p.room_alias && <Field label="Room" value={p.room_alias} />}
              {p.install_requirements && (
                <Field
                  label="Install requirements"
                  value={p.install_requirements}
                />
              )}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
