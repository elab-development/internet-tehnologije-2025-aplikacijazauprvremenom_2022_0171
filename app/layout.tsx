import type { Metadata } from "next";
import { Raleway, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { AppFooter, AppFooterLoader } from "@/components/app-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const raleway = Raleway({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Time Manager",
  description: "Licni centar za planiranje zadataka, kalendara, beleski i podsetnika.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const density = cookieStore.get("tm-density")?.value === "compact" ? "compact" : "comfortable";
  const themeCookie = cookieStore.get("tm-theme")?.value;
  const themeClass = themeCookie === "dark" ? "dark" : "";

  return (
    <html
      lang="sr"
      className={`${raleway.variable} ${spaceGrotesk.variable} ${themeClass}`.trim()}
      suppressHydrationWarning
    >
      <body className="antialiased" data-density={density}>
        <ThemeProvider>
          {children}
          <Suspense fallback={<AppFooterLoader />}>
            <AppFooter />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
