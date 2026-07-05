"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useStore } from "@/lib/store/StoreProvider";
import { listTaxYears } from "@/lib/tax-engine/tax-tables";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/income",
    label: "Income",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 3v12m0-12 4 4m-4-4-4 4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    ),
  },
  {
    href: "/income/upload",
    label: "Upload payslip",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 16V6m0 0 4 4m-4-4-4 4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    ),
  },
  {
    href: "/other-income",
    label: "Other income",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        <circle cx="12" cy="13" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/deductions",
    label: "Deductions",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
        <path d="M9 8h6m-6 4h6" />
      </svg>
    ),
  },
];

function YearSelect() {
  const { state, dispatch } = useStore();
  return (
    <label className="form-control w-full">
      <span className="label-caps mb-1 block opacity-70">Tax year</span>
      <select
        className="select select-bordered select-sm w-full"
        aria-label="Tax year"
        value={state.activeTaxYearId}
        onChange={(event) =>
          dispatch({ type: "setActiveYear", taxYearId: event.target.value })
        }
      >
        {listTaxYears().map((year) => (
          <option key={year.id} value={year.id}>
            {year.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  return (
    <div className="flex h-full w-72 flex-col border-r border-base-300 bg-base-100 p-4">
      <div className="mb-6">
        <p className="text-lg font-bold tracking-tight text-primary">
          SARS TaxCalc
        </p>
        <p className="label-caps text-secondary">Assessment Center</p>
      </div>
      <nav aria-label="Main navigation">
        <ul className="menu w-full gap-1 p-0">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  pathname === item.href
                    ? "active bg-primary font-semibold text-primary-content"
                    : undefined
                }
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto space-y-4 pt-6">
        <YearSelect />
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => item.href === pathname);
  return (
    <div className="drawer lg:drawer-open min-h-dvh">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 border-b border-base-300 bg-base-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <label
              htmlFor="app-drawer"
              aria-label="Open navigation"
              className="btn btn-ghost btn-square btn-sm lg:hidden"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <h1 className="flex-1 text-lg font-semibold tracking-tight">
              {current ? current.label : "SARS TaxCalc"}
            </h1>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-base-300 bg-base-100">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm opacity-70">
            <p>
              Not an official SARS application. For estimation purposes only.
            </p>
            <p>Not tax advice. Not affiliated with or endorsed by SARS.</p>
          </div>
        </footer>
      </div>
      <div className="drawer-side z-20">
        <label
          htmlFor="app-drawer"
          aria-label="Close navigation"
          className="drawer-overlay"
        />
        <SidebarContent />
      </div>
    </div>
  );
}
