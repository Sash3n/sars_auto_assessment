import type { Metadata } from "next";
import AccountPage from "@/components/pages/AccountPage";

export const metadata: Metadata = {
  title: "Account | SARS Auto-Assessment Calculator",
};

export default function Account() {
  return <AccountPage />;
}
