import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthGate } from "@/components/auth/AuthGate";

export const metadata: Metadata = {
  title: "SGP-LITE",
  description: "Gestión simple de cotizaciones y requerimientos",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
