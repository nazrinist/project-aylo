import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aylo — From intent to done",
  description: "Tell Aylo what you need. Aylo turns intent into action.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
