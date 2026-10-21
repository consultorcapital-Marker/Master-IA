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
  title: "Master IA — Tu asistente inteligente",
  description:
    "Chatea con una IA avanzada: responde preguntas, escribe textos, genera código y mucho más. Interfaz moderna estilo ChatGPT.",
  keywords: ["IA", "asistente", "chat", "ChatGPT", "inteligencia artificial", "chatbot"],
  authors: [{ name: "Master IA" }],
  openGraph: {
    title: "Master IA — Tu asistente inteligente",
    description: "Chatea con una IA avanzada en español: preguntas, escritura, código y más.",
    siteName: "Master IA",
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
