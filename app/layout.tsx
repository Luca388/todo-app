import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./redesign.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#173e31",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host?.startsWith("localhost")
        ? "http"
        : "https";
  const safeHost =
    host && !/[\s/?#\\]/.test(host) ? host : "localhost:3000";
  const origin = new URL(`${protocol}://${safeHost}`);
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title: "하루 | 투두와 포모도로",
    description: "할 일을 정리하고 포모도로로 집중하는 하루 관리 도구",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "하루",
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/icon-192.png",
    },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      title: "하루 | 투두와 포모도로",
      description: "할 일을 정리하고 포모도로로 집중하는 하루 관리 도구",
      images: [
        {
          url: socialImage,
          width: 1728,
          height: 909,
          alt: "하루 투두와 포모도로 앱",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "하루 | 투두와 포모도로",
      description: "할 일을 정리하고 포모도로로 집중하는 하루 관리 도구",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
