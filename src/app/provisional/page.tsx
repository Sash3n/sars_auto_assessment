import type { Metadata } from "next";
import ProvisionalTaxPage from "@/components/pages/ProvisionalTaxPage";

export const metadata: Metadata = {
  title: "Provisional tax | SARS Auto-Assessment Calculator",
};

export default function Provisional() {
  return <ProvisionalTaxPage />;
}
