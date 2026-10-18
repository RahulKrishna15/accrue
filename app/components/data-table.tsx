import type { ComponentProps, ReactNode } from "react";
import { cx } from "./ui";

/*
  One table style for every data table in the app.
  - Framed grid: outer border, shaded header row, rules between rows and between columns.
  - Numbers right-aligned in tabular figures so decimals line up down a column.
  - Stays a table on phones: the frame scrolls sideways and the first column stays pinned.
*/

export function DataTable({
  caption,
  minWidth = "40rem",
  className,
  children,
}: {
  /** Read by screen readers; not shown. */
  caption: string;
  /** Below this width the table scrolls sideways instead of squashing columns. */
  minWidth?: string;
  className?: string;
  children: ReactNode;
}) {
  // `relative` keeps absolutely positioned content (sr-only labels) inside the scroll frame.
  return (
    <div className={cx("relative overflow-x-auto rounded-panel border border-line-strong/60 bg-surface", className)}>
      <table className="w-full border-collapse text-left text-[15px] [&_tbody:last-child_tr:last-child>*]:border-b-0" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

const edge = "border-line [&:not(:first-child)]:border-l";
const pin = "sticky left-0 z-[1]";

export function Th({
  numeric,
  pinned,
  className,
  ...props
}: ComponentProps<"th"> & { numeric?: boolean; pinned?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-b-line-strong/60 bg-sunk px-4 py-2.5 text-sm font-medium whitespace-nowrap text-muted",
        edge,
        numeric && "text-right",
        pinned && pin,
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  numeric,
  pinned,
  className,
  ...props
}: ComponentProps<"td"> & { numeric?: boolean; pinned?: boolean }) {
  return (
    <td
      className={cx(
        "border-b px-4 py-3 align-middle",
        edge,
        numeric && "num text-right whitespace-nowrap",
        // A pinned cell needs its own fill so scrolled columns pass underneath it.
        pinned && cx(pin, "bg-surface"),
        className,
      )}
      {...props}
    />
  );
}

/** Row header cell (first column of a body row): announced with its row's data. */
export function RowTh({ pinned, className, ...props }: ComponentProps<"th"> & { pinned?: boolean }) {
  return (
    <th
      scope="row"
      className={cx("border-b px-4 py-3 align-middle font-medium text-ink", edge, pinned && cx(pin, "bg-surface"), className)}
      {...props}
    />
  );
}

/** Full-width label row that groups the rows under it, e.g. a day. */
export function GroupRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={colSpan} className="border-y border-line bg-sunk/50 px-4 py-2 text-sm font-medium text-ink">
        <span className="sticky left-4">{children}</span>
      </th>
    </tr>
  );
}

/** Body row: opaque hover tint, so a pinned cell still covers what scrolls under it. */
export const rowClass = "hover:[&>*]:bg-sunk";
