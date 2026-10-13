import type { ReactNode } from "react";
import { Drift } from "./motion";
import { cx } from "./ui";

/*
  CSS-only background layers (rules in globals.css). They sit at z -1 inside an
  isolated parent, never take pointer events and are hidden from assistive tech.
  Theme values come from the --wash / --dots / --glow tokens.
*/

/** Hero: amber radial wash, an olive dot grid behind the earnings card, and one slow glow. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="bg-hero-fade pointer-events-none absolute inset-0 -z-1 overflow-hidden">
      <div className="bg-hero-wash absolute inset-0" />
      <div className="bg-dot-grid absolute inset-0" />
      <Drift className="bg-hero-glow absolute top-[8%] right-[-18%] size-[46rem] rounded-full max-lg:top-auto max-lg:right-[-40%] max-lg:bottom-[-10%] max-lg:size-[34rem]" />
    </div>
  );
}

/** Forest surface with an amber glow from one corner and fixed fine grain. Text on it uses the panel-* tokens. */
export function ForestPanel({
  children,
  className,
  glow = "top-right",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  glow?: "top-right" | "bottom-left";
  as?: "div" | "section";
}) {
  return <Tag className={cx("forest-panel relative isolate overflow-hidden rounded-panel text-panel-ink", glow === "bottom-left" && "forest-panel-bl", className)}>{children}</Tag>;
}

/** App pages: a faint wash at the very top only, above headers and never behind forms or tables. */
export function AppWash() {
  return <div aria-hidden className="bg-app-wash pointer-events-none absolute inset-x-0 top-0 -z-1 h-64" />;
}
