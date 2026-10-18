import type { Metadata } from "next";
import { CreateFund } from "@/components/app/create-fund";
import { PageGuide } from "@/components/page-guide";
import { PageHeader, enter } from "@/components/ui";

export const metadata: Metadata = { title: "Create a fund" };

export default function NewFundPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader guide title="Create a fund" description="Set the terms investors buy into. The connected wallet becomes the manager and receives invested USDC and fees." />
      <div className="enter" style={enter(2)}>
        <CreateFund />
      </div>
      <PageGuide page="createFund" />
    </div>
  );
}
