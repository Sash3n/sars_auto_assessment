import Link from "next/link";
import type { ReactNode } from "react";

interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
}

/*
 * Clickable summary tile for the dashboard stat row, per the design
 * reference: icon, label-caps label, and a value that links through to
 * the page where that figure is captured or explained.
 */
export default function StatTile({ icon, label, value, href }: StatTileProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 transition hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="label-caps opacity-60">{label}</span>
        <span className="currency text-lg font-semibold">{value}</span>
      </span>
    </Link>
  );
}
