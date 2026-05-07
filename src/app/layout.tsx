import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scope Check",
  description:
    "Job site submittal & compliance assistant — catch missed scope before walls close up.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scope Check",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
