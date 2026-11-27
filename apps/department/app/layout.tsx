import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrievX Department Portal",
  description: "Department complaint workspace for GrievX"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
