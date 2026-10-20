import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SortMedication",
  description: "Stock control for independent pharmacies: batches, expiry dates and a full audit trail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
