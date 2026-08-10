import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusBites Student - Canteen Food Delivery",
  description:
    "Order fresh snacks and meals from the canteen in under 30 seconds. Real-time floor and room tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

