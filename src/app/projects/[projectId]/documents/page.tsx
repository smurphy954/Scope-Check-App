import { ComingSoon } from "@/components/coming-soon";

export default function DocumentsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <ComingSoon
      title="Upload documents"
      projectId={params.projectId}
      phase="Phase 2"
      description="Upload drawings, contracts, and submittals. Claude will extract requirements and tag them by room."
    />
  );
}
