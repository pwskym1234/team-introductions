import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lumen-brand-analytics-20261003.snu-chatgpt-5678.chatgpt.site"),
  title: {
    default: "Lumen 브랜드 분석",
    template: "%s",
  },
  description: "고객 질문이 안전 확인과 상품 평가를 거쳐 어떤 안내와 행동으로 이어졌는지 탐색하는 브랜드 분석 도구",
  openGraph: {
    title: "Lumen 브랜드 분석",
    description: "질문부터 적격 상품 노출과 다음 행동까지, 실제 이벤트 순서로 확인합니다.",
    url: "/",
    type: "website",
    images: [{ url: "/lumen-analytics-og-v2.jpg", width: 1200, height: 630, alt: "질문이 안전 확인과 상품 적격성 평가를 거쳐 분석 화면으로 이어지는 흐름" }],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
