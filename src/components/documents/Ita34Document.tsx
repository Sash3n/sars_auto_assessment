"use client";

import { Fragment, type ReactNode } from "react";
import type {
  StatementDocument,
  StatementNote,
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
 * steel-blue column headers, the reference's Code / Description and detail /
 * Computations & adjustments / Amount assessed four-column layout, and
 * numbered notes. The paper look is deliberately independent of the app's
 * own theme, white background and dark text regardless of light or dark
 * mode, since that is what both the on-screen preview and the printed PDF
 * should look like.
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

const cellBorder = "border-t border-[#8ea9c7]/40";

function SectionBanner({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#1e4e79] px-4 py-2 text-sm font-bold text-white">
      {children}
    </div>
  );
}

/*
 * Shared column widths so the Code and amount columns line up across every
 * table in the document, the way one continuous ITA34 page reads.
 */
function FourColGroup() {
  return (
    <colgroup>
      <col className="w-14 sm:w-20" />
      <col />
      <col className="w-28 sm:w-40" />
      <col className="w-28 sm:w-40" />
    </colgroup>
  );
}

function FourColHeader() {
  return (
    <tr className="bg-[#c9d6e6] text-xs font-semibold text-[#1e4e79]">
      <th className="px-3 py-2 text-left">Code</th>
      <th className="px-3 py-2 text-left">Description and detail</th>
      <th className="px-3 py-2 text-right">
        Computations &amp; adjustments
      </th>
      <th className="px-3 py-2 text-right">Amount assessed</th>
    </tr>
  );
}

function StatementBodyRow(row: StatementRow) {
  if (row.narrative) {
    return (
      <tr>
        <td className={`${cellBorder} px-3 py-1.5`} />
        <td
          colSpan={3}
          className={`${cellBorder} px-3 py-1.5 text-xs italic text-[#1e4e79]`}
        >
          {row.description}
        </td>
      </tr>
    );
  }
  return (
    <tr className={row.emphasis ? "bg-[#eef2f8] font-semibold" : undefined}>
      <td className={`${cellBorder} px-3 py-1.5 font-mono text-xs text-[#1e4e79]`}>
        {row.code ?? ""}
      </td>
      <td className={`${cellBorder} px-3 py-1.5 ${row.indent ? "pl-10" : ""}`}>
        {row.description}
      </td>
      <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
        {row.computation === undefined ? "" : formatRand(row.computation)}
      </td>
      <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
        {row.amount === undefined ? "" : formatRand(row.amount)}
      </td>
    </tr>
  );
}

function CategoryHeadingRow({
  title,
  total,
}: {
  title: string;
  total: number;
}) {
  return (
    <tr className="bg-[#eef2f8] font-semibold">
      <td colSpan={3} className={`${cellBorder} px-3 py-1.5`}>
        {title}
      </td>
      <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
        {formatRand(total)}
      </td>
    </tr>
  );
}

function GrandTotalRow({ title, total }: { title: string; total: number }) {
  return (
    <tr className="bg-[#c9d6e6] font-bold">
      <td colSpan={3} className={`${cellBorder} px-3 py-2`}>
        {title}
      </td>
      <td className={`currency ${cellBorder} px-3 py-2 text-right`}>
        {formatRand(total)}
      </td>
    </tr>
  );
}

function SectionedTable({
  banner,
  sections,
  totalTitle,
  total,
}: {
  banner: string;
  sections: StatementSection[];
  totalTitle: string;
  total: number;
}) {
  return (
    <section>
      <SectionBanner>{banner}</SectionBanner>
      <table className="w-full text-sm">
        <FourColGroup />
        <thead>
          <FourColHeader />
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <CategoryHeadingRow
                title={section.title}
                total={section.total}
              />
              {section.rows.map((row, index) => (
                <StatementBodyRow
                  key={`${section.title}-${row.code ?? row.description}-${index}`}
                  {...row}
                />
              ))}
            </Fragment>
          ))}
          <GrandTotalRow title={totalTitle} total={total} />
        </tbody>
      </table>
    </section>
  );
}

function DetailsBlock({ details }: { details: StatementDocument["details"] }) {
  const rows: [string, string][] = [
    ["Year of assessment", details.yearOfAssessment],
    ["Date generated", details.dateGenerated],
    ["Type of document", details.typeOfDocument],
  ];
  return (
    <section>
      <SectionBanner>Details</SectionBanner>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className={`${cellBorder} px-3 py-1.5 text-[#1e4e79]`}>
                {label}
              </td>
              <td className={`${cellBorder} px-3 py-1.5 text-right`}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function NotesSection({ notes }: { notes: StatementNote[] }) {
  return (
    <section>
      <SectionBanner>Notes</SectionBanner>
      <table className="w-full text-sm">
        <colgroup>
          <col className="w-14 sm:w-20" />
          <col />
          <col className="w-28 sm:w-40" />
        </colgroup>
        <thead>
          <tr className="bg-[#c9d6e6] text-xs font-semibold text-[#1e4e79]">
            <th className="px-3 py-2" />
            <th className="px-3 py-2" />
            <th className="px-3 py-2 text-right">Amount assessed</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note, index) => (
            <Fragment key={note.heading}>
              <tr className="bg-[#eef2f8] font-semibold">
                <td className={`${cellBorder} px-3 py-1.5 text-[#1e4e79]`}>
                  {index + 1}
                </td>
                <td className={`${cellBorder} px-3 py-1.5`}>{note.heading}</td>
                <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
                  {note.amount === undefined ? "" : formatRand(note.amount)}
                </td>
              </tr>
              {note.rows?.map((row) => (
                <tr key={`${note.heading}-${row.label}`}>
                  <td className={`${cellBorder} px-3 py-1.5`} />
                  <td className={`${cellBorder} px-3 py-1.5 text-[#1e4e79]`}>
                    {row.label}
                  </td>
                  <td
                    className={`currency ${cellBorder} px-3 py-1.5 text-right`}
                  >
                    {row.value}
                  </td>
                </tr>
              ))}
              {note.paragraphs?.map((paragraph) => (
                <tr key={`${note.heading}-${paragraph}`}>
                  <td className={`${cellBorder} px-3 py-1.5`} />
                  <td
                    colSpan={2}
                    className={`${cellBorder} px-3 py-1.5 text-xs text-[#1e4e79]`}
                  >
                    {paragraph}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SoloDocument({ document }: SoloProps) {
  return (
    <>
      <DetailsBlock details={document.details} />

      <section>
        <SectionBanner>Balance of Account after this Assessment</SectionBanner>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#c9d6e6] text-xs font-semibold text-[#1e4e79]">
              <th className="px-3 py-2 text-left">Description</th>
              <th className="w-28 px-3 py-2 text-right sm:w-40">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cellBorder} px-3 py-1.5`}>
                {document.balanceOfAccount.description}
              </td>
              <td
                className={`currency ${cellBorder} px-3 py-1.5 text-right font-semibold`}
              >
                {formatRand(document.balanceOfAccount.amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <SectionBanner>Assessment Summary Information</SectionBanner>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#c9d6e6] text-xs font-semibold text-[#1e4e79]">
              <th className="px-3 py-2 text-left">Description</th>
              <th className="w-28 px-3 py-2 text-right sm:w-40">
                Amount assessed
              </th>
            </tr>
          </thead>
          <tbody>
            {document.summary.map((row) => (
              <tr
                key={row.description}
                className={row.emphasis ? "bg-[#eef2f8] font-semibold" : undefined}
              >
                <td className={`${cellBorder} px-3 py-1.5`}>
                  {row.description}
                </td>
                <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
                  {row.amount === undefined ? "" : formatRand(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <SectionBanner>Tax calculation</SectionBanner>
        <table className="w-full text-sm">
          <FourColGroup />
          <thead>
            <FourColHeader />
          </thead>
          <tbody>
            {document.taxCalculation.map((row, index) => (
              <StatementBodyRow
                key={`${row.code ?? row.description}-${index}`}
                {...row}
              />
            ))}
          </tbody>
        </table>
      </section>

      {document.income.length > 0 ? (
        <SectionedTable
          banner="Income"
          sections={document.income}
          totalTitle="Income"
          total={document.incomeTotal}
        />
      ) : null}

      {document.deductions.length > 0 ? (
        <SectionedTable
          banner="Deductions allowed"
          sections={document.deductions}
          totalTitle="Deductions allowed"
          total={document.deductionsTotal}
        />
      ) : null}

      <section>
        <SectionBanner>Taxable income</SectionBanner>
        <table className="w-full text-sm">
          <tbody>
            <tr className="font-semibold">
              <td className="px-3 py-1.5">
                Taxable income subject to normal tax
              </td>
              <td className="currency w-28 px-3 py-1.5 text-right sm:w-40">
                {formatRand(document.taxableIncome.amount)}
              </td>
            </tr>
            <tr>
              <td className={`${cellBorder} px-3 py-1.5`}>
                Rating percentage (%)
              </td>
              <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
                {document.taxableIncome.ratingPercent.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {document.notes.length > 0 ? (
        <NotesSection notes={document.notes} />
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
          <div className="flex items-center justify-between border-t border-[#8ea9c7]/40 bg-[#eef2f8] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#1e4e79]">
            <span>{group.title}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#c9d6e6] text-xs font-semibold text-[#1e4e79]">
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Description and detail</th>
                <th className="px-3 py-2 text-right">Your calculation</th>
                <th className="px-3 py-2 text-right">SARS assessment</th>
                <th className="px-3 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr
                  key={row.code ?? row.key ?? row.description}
                  className={
                    row.status === "mismatch" ? "bg-[#fbe9e9]" : undefined
                  }
                >
                  <td className={`${cellBorder} px-3 py-1.5 font-mono text-xs text-[#1e4e79]`}>
                    {row.code ?? ""}
                  </td>
                  <td className={`${cellBorder} px-3 py-1.5`}>
                    {row.description}
                  </td>
                  <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
                    {row.mineAmount === null ? "" : formatRand(row.mineAmount)}
                  </td>
                  <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
                    {row.sarsAmount === null ? "" : formatRand(row.sarsAmount)}
                  </td>
                  <td className={`currency ${cellBorder} px-3 py-1.5 text-right`}>
                    {row.delta === null ? "" : formatRand(row.delta)}
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
      <div className="space-y-4 pb-4">
        {isComparison(props) ? (
          <ComparisonDocument {...props} />
        ) : (
          <SoloDocument {...props} />
        )}
      </div>
    </div>
  );
}
