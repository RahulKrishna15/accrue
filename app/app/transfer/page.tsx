import type { Metadata } from "next";
import { TransferView } from "@/components/app/transfer-view";
import { PageGuide } from "@/components/page-guide";
import { PageHeader, enter } from "@/components/ui";

export const metadata: Metadata = { title: "Transfer shares" };

export default function TransferPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader guide title="Transfer shares" description="Send fund shares to another wallet. Income each side earned so far stays with them." />
      <div className="enter" style={enter(2)}>
        <TransferView />
      </div>
      <PageGuide page="transfer" />
    </div>
  );
}
