import type { ReactNode } from "react";

/*
 * Mobile-only action bar pinned above the bottom tab dock, per the design
 * reference: a persistent summary figure and primary action while the page
 * scrolls. Hidden on desktop where the sidebar layout has no dock.
 */
export default function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[3.4rem] z-10 border-t border-base-300 bg-base-100 px-4 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:hidden print:hidden">
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  );
}
