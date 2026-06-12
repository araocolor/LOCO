import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import AppDeepLinkHandler from "@/components/features/AppDeepLinkHandler";

export const metadata: Metadata = {
  title: {
    default: "Xlatin — 라틴댄스 클래스",
    template: "%s | Xlatin",
  }, 
  description: "라틴댄스 클래스를 찾고 개설하는 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full" style={{ backgroundColor: '#ffffff' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </head>
      <body className="h-full flex flex-col antialiased hide-scrollbar bg-gray-100 overflow-hidden">
        <div className="safe-area-top-bar" />
        <AppDeepLinkHandler />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
