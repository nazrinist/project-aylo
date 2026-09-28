import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Aylo — Find a beauty appointment in Baku",
    template: "%s · Aylo",
  },
  description: "Describe the beauty service, place, time, and budget. Aylo finds and ranks matching Baku appointments.",
  applicationName: "Aylo",
  keywords: ["Baku beauty", "beauty appointment", "hair", "makeup", "nails"],
  openGraph: {
    type: "website",
    title: "Aylo — From intent to appointment",
    description: "Find matching beauty appointments in Baku from one natural-language request.",
    siteName: "Aylo",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
