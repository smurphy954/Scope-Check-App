import { ComingSoon } from "@/components/coming-soon";

export default function CameraPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <ComingSoon
      title="Camera"
      projectId={params.projectId}
      phase="Phase 5"
      description="One-tap photo capture, then Claude vision identifies the product and matches it to a submittal."
    />
  );
}
