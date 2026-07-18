import type { Metadata } from "next";
import IncomePage from "@/components/pages/IncomePage";

export const metadata: Metadata = {
  title: "Income | SARS Auto-Assessment Calculator",
};

export default function Income() {
  return <IncomePage />;
}
