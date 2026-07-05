import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SARS Auto-Assessment Calculator",
  description:
    "Independently estimate what your South African SARS annual assessment should look like, built from payslips and other income inputs. Not tax advice. Not affiliated with or endorsed by SARS.",
};

/*
 * Runs before first paint so the correct theme is applied before anything
 * renders. Must stay dependency-free and inline: it executes before React
 * hydrates. Mirrors resolveInitialTheme in src/lib/theme.ts.
 */
const themeInitScript = `(function(){var d=document.documentElement;var t=null;try{t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}if(t!=="light"&&t!=="dark"){t=(typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"}d.setAttribute("data-theme",t);d.style.colorScheme=t})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-base-200 text-base-content min-h-dvh`}
      >
        {children}
      </body>
    </html>
  );
}
