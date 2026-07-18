import Link from "next/link";

export interface FlowStep {
  label: string;
  href: string;
}

/**
 * The capture flow shown in the progress stepper, in order. Shared so every
 * page renders the same steps and only the active index differs.
 */
export const CAPTURE_FLOW_STEPS: FlowStep[] = [
  { label: "Upload", href: "/income/upload" },
  { label: "Income", href: "/income" },
  { label: "Other income", href: "/other-income" },
  { label: "Deductions", href: "/deductions" },
  { label: "Results", href: "/results" },
];

/*
 * Progress stepper per the design reference. Steps up to and including the
 * active one are highlighted; every step is a link so the flow can be
 * entered at any point.
 */
export default function Stepper({
  steps = CAPTURE_FLOW_STEPS,
  activeIndex,
}: {
  steps?: FlowStep[];
  activeIndex: number;
}) {
  return (
    <nav aria-label="Capture progress">
      <ul className="steps w-full text-xs">
        {steps.map((step, index) => (
          <li
            key={step.href}
            className={`step ${index <= activeIndex ? "step-primary" : ""}`}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <Link href={step.href} className="hover:underline">
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
