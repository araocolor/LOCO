import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

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
      <body className="min-h-full flex flex-col antialiased hide-scrollbar">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
