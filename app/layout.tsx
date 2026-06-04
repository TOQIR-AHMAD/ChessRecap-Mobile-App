import type { Metadata } from "next";
import { Ubuntu, Ubuntu_Mono } from "next/font/google";
import "./globals.css";

import { AppSidebar, MobileTopBar } from "@/components/layout/AppSidebar";

const ubuntu = Ubuntu({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const ubuntuMono = Ubuntu_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ChessFold — Free chess analysis",
  description:
    "Analyse your chess games for free. Every move graded, accuracy scored, and the engine's best line — all running in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ubuntu.variable} ${ubuntuMono.variable} dark h-full antialiased`}
    >
      <body
        className="min-h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileTopBar />
            <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
            <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground md:px-8">
              Developed by <span className="font-medium text-foreground">Toqir Ahmad</span>
              <span className="px-1.5">·</span>
              <a
                href="mailto:toqirahmad7@gmail.com"
                className="text-primary transition-colors hover:underline"
              >
                toqirahmad7@gmail.com
              </a>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
