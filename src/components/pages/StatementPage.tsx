"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Ita34Document from "@/components/documents/Ita34Document";
import {
  readComparisonHandoff,
  type ComparisonHandoff,
} from "@/lib/document/handoff";
import { buildStatementDocument } from "@/lib/document/statement";
import { useActiveYear } from "@/lib/store/StoreProvider";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

export default function StatementPage() {
  const year = useActiveYear();
  const tables = getTaxYear(year.taxYearId);
  const searchParams = useSearchParams();
  const wantsComparison = searchParams.get("mode") === "compare";

  /*
   * Read once on mount rather than inline in render: sessionStorage access
   * is a side effect, and useState's initializer runs exactly once per
   * mount even under Strict Mode's dev double-render, unlike a bare call
   * during render.
   */
  const [handoff] = useState<ComparisonHandoff | null>(() =>
    wantsComparison ? readComparisonHandoff() : null,
  );

  const assessment = useMemo(
    () => composeAssessment(year, tables),
    [year, tables],
  );
  const statementDocument = useMemo(
    () => buildStatementDocument(assessment, tables),
    [assessment, tables],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Assessment statement
          </h2>
          <p className="mt-1 text-sm opacity-70">
            Styled after the SARS ITA34, for {tables.label}
            {handoff ? ", compared line by line with SARS" : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={handoff ? "/compare" : "/results"}
            className="btn btn-ghost btn-sm"
          >
            Back
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => window.print()}
          >
            Export PDF
          </button>
        </div>
      </div>

      {handoff ? (
        <Ita34Document
          comparison={{ yearLabel: handoff.yearLabel, rows: handoff.rows }}
        />
      ) : (
        <Ita34Document document={statementDocument} />
      )}
    </div>
  );
}
