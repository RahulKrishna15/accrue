import { ArrowRight, ArrowsLeftRight, CurrencyCircleDollar, HandCoins, Vault } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { ForestPanel, HeroBackdrop } from "@/components/backgrounds";
import { FairSplit } from "@/components/landing/fair-split";
import { HeroEarnings } from "@/components/landing/hero-earnings";
import { HeroCopy } from "@/components/landing/hero-copy";
import { FadeUp as Reveal, GrowLine, ScrollLine } from "@/components/motion";
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
    ix: "execute",
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
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-20 lg:pb-28">
          <HeroCopy />
          <HeroEarnings />
        </div>
      </section>

      {/* Fair split */}
      <section id="fair-split" className="scroll-mt-28">
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

      {/* How it works: vertical steps on mobile, a horizontal rail on desktop */}
      <section className="border-t border-line bg-sunk">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <Reveal className="max-w-[60ch]">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Four instructions, one hook</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Each step is a single program instruction. The Transfer Hook keeps income fair whenever shares move.
            </p>
          </Reveal>
          <ScrollLine className="mt-12 lg:mt-16" lineClassName="top-5 bottom-5 left-5 lg:hidden">
            <ol className="flex flex-col gap-10 lg:grid lg:grid-cols-4 lg:gap-8">
              {STEPS.map((s, i) => (
                <Reveal
                  key={s.title}
                  as="li"
                  delay={i * 0.06}
                  className="relative grid grid-cols-[2.5rem_1fr] gap-4 lg:grid-cols-1 lg:content-start lg:gap-6"
                >
                  <span className="relative inline-flex size-10 items-center justify-center rounded-control border border-line bg-surface text-accent">
                    <s.icon size={22} aria-hidden />
                  </span>
                  {i < STEPS.length - 1 ? (
                    <GrowLine delay={0.2 + i * 0.12} className="top-5 left-[3.25rem] -right-5 hidden lg:block" />
                  ) : null}
                  <div>
                    <h3 className="text-lg font-semibold text-ink">
                      {s.title}
                      <code className="ml-2 font-mono text-sm font-normal text-muted lg:mt-1 lg:ml-0 lg:block">{s.ix}</code>
                    </h3>
                    <p className="mt-2 max-w-[60ch] leading-relaxed text-muted lg:mt-3 lg:text-[15px]">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </ScrollLine>
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
          <div className="mt-10 grid gap-8 md:grid-cols-[1.05fr_1fr] md:gap-12">
            <Reveal className="rounded-panel shadow-[0_30px_60px_-34px_var(--lift)]">
              <ForestPanel className="flex h-full flex-col p-6 md:p-8">
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
              </ForestPanel>
            </Reveal>
            <ul className="flex flex-col divide-y divide-line self-center">
              {OTHERS.map((o, i) => (
                <Reveal key={o.name} as="li" delay={0.05 * (i + 1)} className="py-6 first:pt-0 last:pb-0">
                  <p className="font-semibold text-ink">{o.name}</p>
                  <p className="mt-2 max-w-[52ch] leading-relaxed text-muted">{o.how}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Closing: forest band */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 md:pb-24">
        <Reveal>
          <ForestPanel glow="bottom-left" className="grid gap-8 px-6 py-12 sm:px-10 md:grid-cols-[1fr_auto] md:items-end md:py-16">
            <h2 className="max-w-[22ch] text-3xl font-semibold tracking-tight text-balance md:text-4xl">See it with sample funds on devnet</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/funds" className={buttonClass("panel", "lg")}>
                Explore funds <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/funds/new" className={buttonClass("panelGhost", "lg")}>
                Create a fund
              </Link>
            </div>
          </ForestPanel>
        </Reveal>
      </section>
    </>
  );
}
