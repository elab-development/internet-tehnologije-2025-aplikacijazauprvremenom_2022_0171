import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return (
    <PageLoader
      title="Loading Time Manager"
      description="Starting your dashboard and restoring the latest context..."
    />
  );
}
