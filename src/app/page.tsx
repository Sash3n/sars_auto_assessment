import Link from "next/link";

const sections = [
  {
    href: "/income",
    title: "Employment income",
    body: "Capture every payslip: any number of employers, months, allowances, and fringe benefits.",
    action: "Capture payslips",
  },
  {
    href: "/other-income",
    title: "Other income",
    body: "Rental properties with expense apportionment, freelance income, interest, dividends, and capital disposals.",
    action: "Capture other income",
  },
  {
    href: "/deductions",
    title: "Deductions and household",
    body: "Your details, medical costs, retirement annuities, donations, home office, and a full dependents model.",
    action: "Capture deductions",
  },
];

export default function HomePage() {
  return (
    <div>
      <span className="badge badge-accent badge-outline rounded-full">
        Estimate, then compare
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        SARS Auto-Assessment Calculator
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
        A personal decision-support tool that independently estimates what
        your South African annual assessment (ITA34) should look like, built
        from payslips and other income and deduction inputs, so discrepancies
        in the SARS auto-assessment can be caught inside the correction
        window.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <article
            key={section.href}
            className="card border border-base-300 bg-base-100 shadow-sm"
          >
            <div className="card-body">
              <h2 className="card-title text-lg">{section.title}</h2>
              <p className="text-sm leading-relaxed opacity-80">
                {section.body}
              </p>
              <div className="card-actions mt-2">
                <Link href={section.href} className="btn btn-primary btn-sm">
                  {section.action}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-sm opacity-70">
        The tax engine, assessment results, and the SARS comparison view build
        on what you capture here. Everything stays in your browser until you
        choose otherwise.
      </p>
    </div>
  );
}
