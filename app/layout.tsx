import type { Metadata, Viewport } from "next";
import "./globals.css";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const title = "WorkInGYM — Your daily stronger";
const description =
  "Three focused gym sessions, exercise demos, weight and rep logging, and room to recover. A six-week strength companion.";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://workingym.mo-hussein217.chatgpt.site",
  ),
  title,
  description,
  icons: { icon: `${basePath}/favicon.svg` },
  appleWebApp: { capable: true, title: "WorkInGYM", statusBarStyle: "default" },
  openGraph: { title, description, type: "website" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f2",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
