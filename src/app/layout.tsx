import type { Metadata } from "next";
import { savedTheme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "SortMedication",
  description: "Stock control for independent pharmacies: batches, expiry dates and a full audit trail.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await savedTheme();
  return (
    <html lang="en" data-theme={theme === "auto" ? undefined : theme}>
      <body>{children}</body>
    </html>
  );
}
