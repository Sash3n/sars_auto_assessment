"use client";

import type { ReactNode } from "react";
import type {
  StatementDocument,
  StatementRow,
  StatementSection,
} from "@/lib/document/statement";
import { formatRand } from "@/lib/format";
import {
  groupComparisonRows,
  type ComparisonRow,
} from "@/lib/tax-engine/compare";

/*
 * Renders an assessment (or a Compare-page comparison) in the visual
 * language of a SARS ITA34 Notice of Assessment: navy section banners,
 * steel-blue column headers, bordered tables, right-aligned mono amounts.
 * The paper look is deliberately independent of the app's own theme, white
 * background and dark text regardless of light or dark mode, since that is
 * what both the on-screen preview and the printed PDF should look like.
 */

interface SoloProps {
  document: StatementDocument;
}

interface ComparisonProps {
  comparison: { yearLabel: string; rows: ComparisonRow[] };
}

type Ita34DocumentProps = SoloProps | ComparisonProps;

function isComparison(props: Ita34DocumentProps): props is ComparisonProps {
  return "comparison" in props;
}

function SectionBanner({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#1e4e79] px-4 py-2 text-sm font-bold text-white">
      {children}
    </div>
  );
}

function CategoryHeading({
  children,
  total,
}: {
  children: ReactNode;
  total?: number;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[#8ea9c7]/40 bg-[#eef2f8] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#1e4e79]">
      <span>{children}</span>
      {total !== undefined ? (
        <span className="currency normal-case">{formatRand(total)}</span>
      ) : null}
    </div>
  );
}

function ColumnHeaderRow({ columns }: { columns: string[] }) {
  return (
    <tr className="bg-[#c9d6e6] text-xs font-semibold uppercase tracking-wide text-[#1e4e79]">
      {columns.map((column, index) => (
        <th
          key={column}
          className={`px-4 py-2 text-left ${index > 0 ? "text-right" : ""}`}
        >
          {column}
        </th>
      ))}
    </tr>
  );
}

function StatementAmountRow({ code, description, amount, emphasis }: StatementRow) {
  return (
    <tr className={emphasis ? "bg-[#eef2f8] font-semibold" : undefined}>
      <td className="border-t border-[#8ea9c7]/40 px-4 py-1.5 font-mono text-xs text-[#1e4e79]">
        {code ?? ""}
      </td>
      <td className="border-t border-[#8ea9c7]/40 px-4 py-1.5">
        {description}
      </td>
      <td className="currency border-t border-[#8ea9c7]/40 px-4 py-1.5 text-right">
        {formatRand(amount)}
      </td>
    </tr>
  );
}

function StatementSectionBlock({ section }: { section: StatementSection }) {
  return (
    <div>
      <CategoryHeading total={section.total}>{section.title}</CategoryHeading>
      <table className="w-full text-sm">
        <tbody>
          {section.rows.map((row) => (
            <StatementAmountRow
              key={`${row.code ?? row.description}`}
              {...row}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SoloDocument({ document }: SoloProps) {
  return (
    <>
      <SectionBanner>Balance of Account after this Assessment</SectionBanner>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="px-4 py-1.5">
              {document.balanceOfAccount.description}
            </td>
            <td className="currency px-4 py-1.5 text-right font-semibold">
              {formatRand(document.balanceOfAccount.amount)}
            </td>
          </tr>
        </tbody>
      </table>

      <SectionBanner>Assessment Summary Information</SectionBanner>
      <table className="w-full text-sm">
        <tbody>
          {document.summary.map((row) => (
            <StatementAmountRow
              key={row.description}
              {...row}
            />
          ))}
        </tbody>
      </table>

      <SectionBanner>Tax calculation</SectionBanner>
      <table className="w-full text-sm">
        <thead>
          <ColumnHeaderRow columns={["Code", "Description and detail", "Amount assessed"]} />
        </thead>
        <tbody>
          {document.taxCalculation.map((row) => (
            <StatementAmountRow key={row.description} {...row} />
          ))}
        </tbody>
      </table>

      {document.income.length > 0 ? (
        <>
          <SectionBanner>Income</SectionBanner>
          {document.income.map((section) => (
            <StatementSectionBlock key={section.title} section={section} />
          ))}
        </>
      ) : null}

      {document.deductions.length > 0 ? (
        <>
          <SectionBanner>Deductions allowed</SectionBanner>
          {document.deductions.map((section) => (
            <StatementSectionBlock key={section.title} section={section} />
          ))}
        </>
      ) : null}

      <SectionBanner>Taxable income</SectionBanner>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="px-4 py-1.5 font-semibold">
              Taxable income subject to normal tax
            </td>
            <td className="currency px-4 py-1.5 text-right font-semibold">
              {formatRand(document.taxableIncome.amount)}
            </td>
          </tr>
          <tr>
            <td className="border-t border-[#8ea9c7]/40 px-4 py-1.5">
              Rating percentage (%)
            </td>
            <td className="currency border-t border-[#8ea9c7]/40 px-4 py-1.5 text-right">
              {document.taxableIncome.ratingPercent.toFixed(2)}%
            </td>
          </tr>
        </tbody>
      </table>

      {document.notes.length > 0 ? (
        <>
          <SectionBanner>Notes</SectionBanner>
          <ol className="list-decimal space-y-2 px-8 py-4 text-sm">
            {document.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        </>
      ) : null}
    </>
  );
}

function ComparisonDocument({ comparison }: ComparisonProps) {
  const groups = groupComparisonRows(comparison.rows);
  return (
    <>
      <SectionBanner>
        Comparison with SARS, {comparison.yearLabel}
      </SectionBanner>
      {groups.map((group) => (
        <div key={group.title}>
          <CategoryHeading>{group.title}</CategoryHeading>
          <table className="w-full text-sm">
            <thead>
              <ColumnHeaderRow
                columns={[
                  "Code",
                  "Description and detail",
                  "Your calculation",
                  "SARS assessment",
                  "Variance",
                ]}
              />
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr
                  key={row.code ?? row.key ?? row.description}
                  className={
                    row.status === "mismatch"
                      ? "bg-[#fbe9e9]"
                      : undefined
                  }
                >
                  <td className="border-t border-[#8ea9c7]/40 px-4 py-1.5 font-mono text-xs text-[#1e4e79]">
                    {row.code ?? ""}
                  </td>
                  <td className="border-t border-[#8ea9c7]/40 px-4 py-1.5">
                    {row.description}
                  </td>
                  <td className="currency border-t border-[#8ea9c7]/40 px-4 py-1.5 text-right">
                    {row.mineAmount === null ? "—" : formatRand(row.mineAmount)}
                  </td>
                  <td className="currency border-t border-[#8ea9c7]/40 px-4 py-1.5 text-right">
                    {row.sarsAmount === null ? "—" : formatRand(row.sarsAmount)}
                  </td>
                  <td className="currency border-t border-[#8ea9c7]/40 px-4 py-1.5 text-right">
                    {row.delta === null ? "—" : formatRand(row.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export default function Ita34Document(props: Ita34DocumentProps) {
  return (
    <div className="ita34-doc mx-auto max-w-3xl overflow-hidden rounded-sm border border-[#8ea9c7]/50 bg-white text-[#111827] shadow-sm">
      <div className="border-b-4 border-[#1e4e79] bg-[#fff7e6] px-4 py-2 text-xs font-medium text-[#7a5b00]">
        Independent estimate, styled after the SARS ITA34. Not an official
        SARS document.
      </div>
      {isComparison(props) ? (
        <ComparisonDocument {...props} />
      ) : (
        <SoloDocument {...props} />
      )}
    </div>
  );
}
