import type { Metadata } from "next";
import DeductionsPage from "@/components/pages/DeductionsPage";

export const metadata: Metadata = {
  title: "Deductions | SARS Auto-Assessment Calculator",
};

export default function Deductions() {
  return <DeductionsPage />;
}
