import ThemeToggle from "@/components/ThemeToggle";

const plannedModules = [
  {
    title: "Tax engine",
    body: "Versioned tax year tables, bracket and rebate calculations, medical credits, and the retirement deduction cap, built test-first.",
  },
  {
    title: "Payslip extraction",
    body: "Local-first parsing of payslips: PDF text layer, then on-device OCR. Nothing leaves the browser without explicit consent.",
  },
  {
    title: "SARS comparison",
    body: "A line-by-line diff of your calculated assessment against the SARS auto-assessment, by source code, so discrepancies stand out.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-base-300 bg-base-100">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-primary">
              SARS TaxCalc
            </p>
            <p className="label-caps text-secondary">Assessment Center</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <span className="badge badge-accent badge-outline rounded-full">
          Phase 0 scaffold
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          SARS Auto-Assessment Calculator
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
          A personal decision-support tool that independently estimates what
          your South African annual assessment (ITA34) should look like, built
          from payslips and other income and deduction inputs, so
          discrepancies in the SARS auto-assessment can be caught inside the
          correction window.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plannedModules.map((module) => (
            <article
              key={module.title}
              className="card border border-base-300 bg-base-100 shadow-sm"
            >
              <div className="card-body">
                <span className="badge badge-ghost badge-sm rounded-full label-caps">
                  Planned
                </span>
                <h2 className="card-title text-lg">{module.title}</h2>
                <p className="text-sm leading-relaxed opacity-80">
                  {module.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t border-base-300 bg-base-100">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm opacity-70">
          <p>Not an official SARS application. For estimation purposes only.</p>
          <p>Not tax advice. Not affiliated with or endorsed by SARS.</p>
        </div>
      </footer>
    </div>
  );
}
