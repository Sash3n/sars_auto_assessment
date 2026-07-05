import type { Metadata } from "next";
import OtherIncomePage from "@/components/pages/OtherIncomePage";

export const metadata: Metadata = {
  title: "Other income | SARS Auto-Assessment Calculator",
};

export default function OtherIncome() {
  return <OtherIncomePage />;
}
