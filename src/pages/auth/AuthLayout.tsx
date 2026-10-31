import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CloudSun, Leaf, ShieldCheck, Sprout, TrendingUp } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { APP_TAGLINE } from '@/lib/constants';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-amber-300/20" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Sprout className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-bold">FarmDesk</span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-primary-foreground/70">{APP_TAGLINE}</span>
            </span>
          </Link>
          <h2 className="mt-14 max-w-sm text-3xl font-bold leading-tight">
            The season is complex. Your farm record should not be.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
            Weather, climate, mandi prices, crop suitability, expenses and field activity — connected to your own farm, in one place.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: CloudSun, text: '7-day forecast with source and retrieval time attached' },
              { icon: TrendingUp, text: 'Saved mandi observations and official CSV imports' },
              { icon: Leaf, text: 'Crop scores calculated from your soil, water and climate inputs' },
              { icon: ShieldCheck, text: 'Your records protected by row-level security' },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="pt-1.5 text-sm text-primary-foreground/90">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative rounded-xl border border-white/15 bg-white/10 p-4 text-xs leading-relaxed text-primary-foreground/80">
          <CheckCircle2 className="mb-1 h-4 w-4" />
          FarmDesk never presents an estimate as an observed value. External data carries its source and timestamp; crop, yield and profit figures are clearly marked as estimates.
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <LanguageSwitcher compact />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <Link to="/" className="inline-flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Sprout className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold">FarmDesk</span>
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
