import type { Metadata } from "next";
import Link from "next/link";
import { FundsExplorer } from "@/components/app/funds-explorer";
import { PageGuide } from "@/components/page-guide";
import { PageHeader, enter, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Funds" };

export default function FundsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader guide
        title="Funds"
        description="Every Accrue fund on devnet. Prices are set by each manager and apply to new investments."
        actions={
          <Link href="/funds/new" className={buttonClass("primary")}>
            Create a fund
          </Link>
        }
      />
      <div className="enter" style={enter(2)}>
        <FundsExplorer />
      </div>
      <PageGuide page="funds" />
    </div>
  );
}
