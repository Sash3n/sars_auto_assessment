import type { Metadata } from "next";
import ResultsPage from "@/components/pages/ResultsPage";

export const metadata: Metadata = {
  title: "Results | SARS Auto-Assessment Calculator",
};

export default function Results() {
  return <ResultsPage />;
}
