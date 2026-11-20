import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email approval for Google Calendar",
  description: "Approve a Calendar event by email with Auth0 CIBA and Token Vault.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-100 text-stone-900">{children}</body>
    </html>
  );
}
