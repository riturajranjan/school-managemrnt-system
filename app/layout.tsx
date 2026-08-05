import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
  title: "Novyra Campus OS",
  description: "Premium, compact school management system.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets `env(safe-area-inset-*)` resolve to real values on notched/home-indicator devices.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // next-themes sets the `dark` class / color-scheme on this element before
      // hydration; suppressHydrationWarning stops React flagging that as a mismatch.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PermissionsProvider>
            <AppShell>{children}</AppShell>
          </PermissionsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
