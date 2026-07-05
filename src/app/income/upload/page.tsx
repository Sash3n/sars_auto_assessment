import type { Metadata } from "next";
import UploadPage from "@/components/pages/UploadPage";

export const metadata: Metadata = {
  title: "Upload payslip | SARS Auto-Assessment Calculator",
};

export default function IncomeUpload() {
  return <UploadPage />;
}
