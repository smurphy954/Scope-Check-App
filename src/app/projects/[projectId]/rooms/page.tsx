import { ComingSoon } from "@/components/coming-soon";

export default function RoomsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <ComingSoon
      title="Rooms"
      projectId={params.projectId}
      phase="Phase 3 & 4"
      description="Reconcile room aliases across documents, then drill into a room for the aggregated pre-close-up checklist."
    />
  );
}
