import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { StoreProvider } from "../lib/store/StoreProvider";

export const metadata: Metadata = {
  title: "Oficina Técnica — IA Gerencial",
  description: "Plataforma de oficina técnica multiagente con supervisión del Gerente General.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
