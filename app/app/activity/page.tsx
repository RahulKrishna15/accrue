import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/app/activity-feed";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader
        title="Activity"
        description="Events the Accrue program emits, read straight from transaction logs. No indexer or backend."
      />
      <Suspense fallback={<Skeleton className="h-64 rounded-panel" />}>
        <ActivityFeed />
      </Suspense>
    </div>
  );
}
