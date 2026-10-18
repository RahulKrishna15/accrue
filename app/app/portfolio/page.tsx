import type { Metadata } from "next";
import { PortfolioView } from "@/components/app/portfolio-view";
import { PageGuide } from "@/components/page-guide";
import { PageHeader, enter } from "@/components/ui";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader guide title="Portfolio" description="Your shares and the income they are earning right now. Claim whenever you like." />
      <div className="enter" style={enter(2)}>
        <PortfolioView />
      </div>
      <PageGuide page="portfolio" />
    </div>
  );
}
