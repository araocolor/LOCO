import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import AppDeepLinkHandler from "@/components/features/AppDeepLinkHandler";

export const metadata: Metadata = {
  title: {
    default: "LOCO — 라틴댄스 클래스",
    template: "%s | LOCO",
  },
  description: "살사·바차타 댄스 클래스를 찾고 개설하는 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col antialiased hide-scrollbar bg-gray-100">
        <AppDeepLinkHandler />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
