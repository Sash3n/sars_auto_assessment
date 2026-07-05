import type { Metadata } from "next";
import ComparePage from "@/components/pages/ComparePage";

export const metadata: Metadata = {
  title: "Compare | SARS Auto-Assessment Calculator",
};

export default function Compare() {
  return <ComparePage />;
}
