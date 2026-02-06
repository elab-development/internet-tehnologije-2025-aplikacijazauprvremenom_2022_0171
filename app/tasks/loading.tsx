import { PageLoader } from "@/components/ui/page-loader";

export default function Loading() {
  return (
    <PageLoader
      title="Loading Workspace"
      description="Fetching tasks, events, reminders, and your preferences..."
    />
  );
}
