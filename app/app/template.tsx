import { PageTransition } from "@/components/motion";

/** Remounts on navigation between top-level routes, so each new page fades in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
