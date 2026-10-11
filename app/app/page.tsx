import { ArrowRight, ArrowsLeftRight, CurrencyCircleDollar, HandCoins, Vault } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { FairSplit } from "@/components/landing/fair-split";
import { HeroEarnings } from "@/components/landing/hero-earnings";
import { HeroCopy } from "@/components/landing/hero-copy";
import { Reveal } from "@/components/landing/reveal";
import { buttonClass } from "@/components/ui";

const STEPS = [
  {
    icon: CurrencyCircleDollar,
    title: "Invest",
    ix: "invest",
    body: "Put in Test USDC and receive share tokens at the fund's set price. Principal goes to the fund treasury, never the income vault.",
  },
  {
    icon: Vault,
    title: "Deposit income",
    ix: "deposit_revenue",
    body: "The manager deposits income in USDC. The management fee is taken first, then the rest streams to holders over the fund's period.",
  },
  {
    icon: ArrowsLeftRight,
    title: "Transfer",
    ix: "execute (Transfer Hook)",
    body: "Token-2022 calls the hook on every transfer. It settles sender and receiver at their old balances, so nobody gains or loses income.",
  },
  {
    icon: HandCoins,
    title: "Claim",
    ix: "claim",
    body: "Holders claim USDC whenever they like. Claims keep working while a fund is paused or closed.",
  },
];

const OTHERS = [
  {
    name: "JitoSOL",
    how: "Staking rewards build up inside the token. You keep the same number of tokens, each worth more SOL.",
  },
  {
    name: "BlackRock BUIDL",
    how: "The price stays at $1. Income arrives as new BUIDL tokens minted to you each month.",
  },
  {
    name: "Scaled UI Amount",
    how: "A multiplier grows every displayed balance at once. Income has to be paid in the same token.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 md:pt-20 lg:min-h-[calc(100dvh-7.5rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-16">
        <HeroCopy />
        <HeroEarnings />
      </section>

      {/* Fair split */}
      <section id="fair-split" className="scroll-mt-28 border-t border-line">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <Reveal className="max-w-[60ch]">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Paid for the days you held</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Alice starts with all 100 tokens and sells some mid-month. Drag the day to watch each holder&apos;s income build up.
            </p>
          </Reveal>
          <Reveal className="mt-10" delay={0.08}>
            <FairSplit />
          </Reveal>
        </div>
      </section>

      {/* How it works: vertical steps */}
      <section className="border-t border-line bg-sunk">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl lg:sticky lg:top-36">
              Four instructions, one hook
            </h2>
          </Reveal>
          <ol className="flex flex-col gap-8">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} as="li" delay={i * 0.05} className="grid grid-cols-[2.5rem_1fr] gap-4">
                  <span className="inline-flex size-10 items-center justify-center rounded-control bg-surface text-accent">
                    <s.icon size={22} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">
                      {s.title} <code className="num ml-1 text-sm font-normal text-muted">{s.ix}</code>
                    </h3>
                    <p className="mt-1 max-w-[60ch] leading-relaxed text-muted">{s.body}</p>
                  </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Comparison: asymmetric 1 + 3 */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <Reveal className="max-w-[60ch]">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Income as cash, not more tokens</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Most yield on Solana is reinvested into what you hold. Accrue pays it out, like a monthly-payout deposit.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Reveal className="md:row-span-3">
              <div className="flex h-full flex-col rounded-panel bg-panel p-6 text-panel-ink md:p-8">
                <p className="text-2xl font-semibold">Accrue</p>
                <dl className="mt-6 grid gap-5">
                  <div>
                    <dt className="text-sm text-panel-muted">Income arrives as</dt>
                    <dd className="mt-1 text-lg">Separate USDC you claim</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-panel-muted">Your share count</dt>
                    <dd className="mt-1 text-lg">Stays fixed</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-panel-muted">When shares change hands</dt>
                    <dd className="mt-1 text-lg">Each side keeps exactly what it earned, enforced by the Transfer Hook</dd>
                  </div>
                </dl>
                <p className="mt-auto pt-8 text-sm text-panel-muted">
                  Built for income funds priced near their real value, such as private credit.
                </p>
              </div>
            </Reveal>
            {OTHERS.map((o, i) => (
              <Reveal key={o.name} delay={0.05 * (i + 1)}>
                <div className="rounded-panel border border-line bg-surface p-6">
                  <p className="font-semibold text-ink">{o.name}</p>
                  <p className="mt-2 leading-relaxed text-muted">{o.how}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
          <Reveal>
            <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              See it with sample funds on devnet
            </h2>
          </Reveal>
          <div className="flex flex-wrap gap-3">
            <Link href="/funds" className={buttonClass("accent", "lg")}>
              Explore funds <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/funds/new" className={buttonClass("secondary", "lg")}>
              Create a fund
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
