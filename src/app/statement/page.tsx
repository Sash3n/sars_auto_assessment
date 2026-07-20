import type { Metadata } from "next";
import { Suspense } from "react";
import StatementPage from "@/components/pages/StatementPage";

export const metadata: Metadata = {
  title: "Statement | SARS Auto-Assessment Calculator",
};

export default function Statement() {
  return (
    <Suspense fallback={null}>
      <StatementPage />
    </Suspense>
  );
}
