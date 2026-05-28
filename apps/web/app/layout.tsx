import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadsploy — Docker-first deployment",
  description: "Self-hosted deployment platform for Dockerized apps and APIs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
