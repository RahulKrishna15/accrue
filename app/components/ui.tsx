import { CaretDown, Question } from "@phosphor-icons/react/ssr";
import type { ButtonHTMLAttributes, ComponentProps, CSSProperties, ReactNode } from "react";
import { formatUnits } from "@/lib/accrue/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Position in an entrance sequence; pair with className="enter" (see globals.css). */
export function enter(i: number, stepMs?: number): CSSProperties {
  return { "--enter-i": i, ...(stepMs ? { "--enter-step": `${stepMs}ms` } : {}) } as CSSProperties;
}

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "panel" | "panelGhost";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  accent: "bg-accent-strong text-on-accent hover:opacity-90",
  secondary: "border border-line-strong text-ink hover:bg-sunk",
  ghost: "text-ink hover:bg-sunk",
  danger: "border border-danger text-danger hover:bg-danger-soft",
  // On forest panels only: ivory fill (12.2:1) and an outlined companion.
  panel: "bg-panel-ink text-panel hover:opacity-90",
  panelGhost: "border border-panel-muted text-panel-ink hover:bg-panel-line",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cx(
    "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium",
    "disabled:cursor-not-allowed disabled:opacity-45",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-[15px]",
    size === "lg" && "h-12 px-5 text-base",
    variants[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-panel border border-line bg-surface", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

/** Base-unit amount in tabular digits, always rounded down. */
export function Amount({
  value,
  decimals = 2,
  prefix = "$",
  suffix,
  className,
}: {
  value: bigint;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cx("num", className)}>
      {prefix}
      {formatUnits(value, decimals)}
      {suffix ? <span className="ml-1 font-sans text-[0.85em] text-muted">{suffix}</span> : null}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={`${htmlFor}-help`} className="text-sm text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  invalid,
  prefix,
  suffix,
  className,
  ...props
}: ComponentProps<"input"> & { id: string; invalid?: boolean; prefix?: string; suffix?: string }) {
  return (
    <div
      className={cx(
        "flex h-11 items-center rounded-control border bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
    >
      {prefix ? <span className="num mr-2 text-muted">{prefix}</span> : null}
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : `${id}-help`}
        className="h-full w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none!"
        {...props}
      />
      {suffix ? <span className="ml-2 shrink-0 text-sm text-muted">{suffix}</span> : null}
    </div>
  );
}

/**
 * Native select with the same frame as TextInput: the platform list stays (keyboard,
 * mobile pickers), only the closed control is restyled with one caret.
 */
export function Select({ className, size = "md", children, ...props }: Omit<ComponentProps<"select">, "size"> & { size?: "sm" | "md" }) {
  return (
    <div className={cx("relative", className)}>
      <select
        className={cx(
          "w-full cursor-pointer appearance-none truncate rounded-control border border-line-strong bg-surface pr-10 pl-3 text-ink",
          "transition-colors hover:border-ink/50 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
          size === "sm" ? "h-10 text-sm" : "h-11 text-[15px]",
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDown size={16} weight="bold" aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
}

/** `guide` adds a link to the page's "How this page works" section (components/page-guide.tsx). */
export function PageHeader({ title, description, actions, guide }: { title: string; description?: ReactNode; actions?: ReactNode; guide?: boolean }) {
  return (
    <div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[65ch]">
        <h1 className="enter text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
        {description ? (
          <p className="enter mt-2 leading-relaxed text-muted" style={enter(1)}>
            {description}
          </p>
        ) : null}
        {guide ? (
          <a
            href="#guide"
            className="enter mt-3 inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
            style={enter(1)}
          >
            <Question size={16} aria-hidden />
            How this page works
          </a>
        ) : null}
      </div>
      {actions ? (
        <div className="enter flex shrink-0 gap-3" style={enter(1)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong px-6 py-10 sm:items-center sm:text-center">
      <div className="text-accent">{icon}</div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="max-w-[48ch] text-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Two-to-three letter mark for a fund; uses the metadata logo when one is set. */
export function FundMark({ symbol, image, size = 40 }: { symbol: string; image?: string; size?: number }) {
  if (image) {
    return (
      // User-supplied URL from token metadata; next/image would need every host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" width={size} height={size} className="shrink-0 rounded-control object-cover" style={{ width: size, height: size }} />
    );
  }
  const tones = [
    "bg-[#606c38] text-[#fefae0]",
    "bg-[#283618] text-[#fefae0] ring-1",
    "bg-[#dda15e] text-[#283618]",
    "bg-[#8f501a] text-[#fefae0]",
  ];
  const tone = tones[[...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span
      aria-hidden
      className={cx("num inline-flex shrink-0 items-center justify-center rounded-control font-semibold ring-panel-line", tone)}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {symbol.slice(0, 3)}
    </span>
  );
}

export function StatusBadge({ paused, closed }: { paused: boolean; closed: boolean }) {
  const [label, cls] = paused
    ? ["Paused", "bg-accent-soft text-accent-strong"]
    : closed
      ? ["Closed", "bg-sunk text-muted"]
      : ["Open", "border border-line-strong text-ink"];
  return <span className={cx("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", cls)}>{label}</span>;
}

export function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg text-ink">{children}</dd>
    </div>
  );
}
