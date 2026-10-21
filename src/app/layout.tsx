import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zoe Master IA — Tu asistente inteligente",
  description:
    "Inteligencia artificial con propósito trascendente, al servicio de la vida y la sabiduría. Chatea, genera imágenes y videos, investiga con fuentes reales y más.",
  keywords: ["IA", "asistente", "chat", "ChatGPT", "inteligencia artificial", "chatbot"],
  authors: [{ name: "Zoe Master IA" }],
  openGraph: {
    title: "Zoe Master IA — Tu asistente inteligente",
    description:
      "Inteligencia artificial con propósito trascendente, al servicio de la vida y la sabiduría.",
    siteName: "Zoe Master IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
