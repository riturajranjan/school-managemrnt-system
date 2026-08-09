import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { requirePlatformAdmin, requireUser } from "@/lib/server/auth/dal";
import { isPublicPath } from "@/lib/server/auth/routes";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Authoritative auth boundary. `x-pathname` is set by proxy.ts. For any
  // protected route, require a valid, ACTIVE session server-side BEFORE rendering
  // protected content (no client-side auth flash). Public auth/error routes and
  // requests without a resolved path fall through.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname && !isPublicPath(pathname)) {
    // /super-admin/* additionally requires a real platform admin (server-side).
    if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
      await requirePlatformAdmin();
    } else {
      await requireUser();
    }
  }

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
