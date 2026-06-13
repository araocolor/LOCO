import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import AppDeepLinkHandler from "@/components/features/AppDeepLinkHandler";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
      <body className="h-full flex flex-col antialiased hide-scrollbar bg-gray-100 overflow-hidden">
        <AppDeepLinkHandler />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
