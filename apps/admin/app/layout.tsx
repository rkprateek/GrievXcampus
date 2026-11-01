import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrievX Campus Admin",
  description: "GrievX Campus complaint management dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
