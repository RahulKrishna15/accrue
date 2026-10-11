import type { Metadata } from "next";
import { ManageView } from "@/components/app/manage-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Manage" };

export default function ManagePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <PageHeader title="Manage" description="Deposit income, adjust price and control the funds this wallet manages." />
      <ManageView />
    </div>
  );
}
