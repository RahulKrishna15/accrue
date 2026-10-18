import type { Address } from "@solana/kit";
import { Suspense } from "react";
import { PageGuide } from "@/components/page-guide";
import { FundView } from "@/components/app/fund-view";
import { Skeleton } from "@/components/ui";

export default function FundPage({ params }: PageProps<"/funds/[mint]">) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<Skeleton className="h-96 rounded-panel" />}>
        {params.then(({ mint }) => (
          <FundView mint={mint as Address} />
        ))}
      </Suspense>
      <PageGuide page="fund" />
    </div>
  );
}
