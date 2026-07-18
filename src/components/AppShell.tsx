"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
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
  {
    href: "/results",
    label: "Results",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8m-8 4h8m-8 4h4" />
      </svg>
    ),
  },
  {
    href: "/compare",
    label: "Compare",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M8 3 4 7l4 4" />
        <path d="M4 7h16" />
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H4" />
      </svg>
    ),
  },
  {
    href: "/provisional",
    label: "Provisional tax",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Account",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
];

/** Key summary views for the mobile bottom-tab bar, per the design reference. */
const DOCK_ITEMS = NAV_ITEMS.filter((item) =>
  ["/", "/income/upload", "/deductions", "/results", "/compare"].includes(
    item.href,
  ),
);

function activateOnKey(event: KeyboardEvent<HTMLElement>) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
  }
}

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
    <div className="flex h-full w-[280px] flex-col border-r border-base-300 bg-base-100 p-4">
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
        <a
          href="#main-content"
          className="btn btn-primary btn-sm sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-10 border-b border-base-300 bg-base-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <label
              htmlFor="app-drawer"
              aria-label="Open navigation"
              role="button"
              tabIndex={0}
              onKeyDown={activateOnKey}
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
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 pb-24 outline-none lg:pb-8"
        >
          {children}
        </main>
        <footer className="hidden border-t border-base-300 bg-base-100 lg:block">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 text-sm opacity-70">
            <p>
              Not an official SARS application. For estimation purposes only.
            </p>
            <p>Not tax advice. Not affiliated with or endorsed by SARS.</p>
          </div>
        </footer>
        <div className="border-t border-base-300 bg-base-100 pb-20 lg:hidden">
          <div className="px-4 py-4 text-xs opacity-70">
            <p>
              Not an official SARS application. For estimation purposes only.
            </p>
            <p>Not tax advice. Not affiliated with or endorsed by SARS.</p>
          </div>
        </div>
        <nav
          aria-label="Quick navigation"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-base-300 bg-base-100 lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {DOCK_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                    pathname === item.href
                      ? "font-semibold text-primary"
                      : "opacity-70"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="drawer-side z-30">
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
