import type { Metadata } from "next";
import { Geist_Mono, Manrope, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const korean = Noto_Sans_KR({
  variable: "--font-korean",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "샘훈호 FAMILY OFFICE 자산 대시보드",
  description: "부부 자산·수익률·연금 통합 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${manrope.variable} ${korean.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AppShell>{children}</AppShell></body>
    </html>
  );
}
