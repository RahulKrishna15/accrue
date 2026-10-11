import type { Metadata } from "next";
import { TransferView } from "@/components/app/transfer-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Transfer shares" };

export default function TransferPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader title="Transfer shares" description="Send fund shares to another wallet. Income each side earned so far stays with them." />
      <TransferView />
    </div>
  );
}
