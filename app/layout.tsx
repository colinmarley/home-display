import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home Display",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: "100%", overflow: "hidden" }}>
      <body style={{ height: "100%", margin: 0, overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
