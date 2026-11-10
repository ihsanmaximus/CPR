import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Client Project Report", description: "Client review and approval workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}