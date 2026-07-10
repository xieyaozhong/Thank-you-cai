import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const dynamic = "force-dynamic";

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await requestOrigin();
  const title = "謝謝你，菜！｜自家菜攤週報";
  const description = "每週新鮮蔬果、真實菜況、雲端訂單、送貨核銷與水果點收藏，一個可愛又實用的自家菜攤。";
  const image = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    applicationName: "謝謝你，菜！",
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "zh_TW",
      title,
      description,
      images: [{ url: image, width: 1731, height: 909, alt: "謝謝你，菜！像素風自家菜攤" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
