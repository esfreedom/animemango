import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCurrentUser } from "@/lib/session";
import { themeScript } from "@/lib/theme";
import "../globals.css";

const latin = Inter({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"], display: "swap" });

// The back office is a separate root layout. It has its own frame and is never indexed.
export const metadata: Metadata = {
  title: { default: "AnimeHub หลังบ้าน", template: "%s | AnimeHub หลังบ้าน" },
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="th" suppressHydrationWarning className={`${latin.variable} ${thai.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-ink">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AdminShell user={user}>{children}</AdminShell>
      </body>
    </html>
  );
}
