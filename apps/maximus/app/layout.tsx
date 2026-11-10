import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Maximus CPR — Workspace", description: "Maximus project manager workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}