import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { RakshaBandhanTheme } from "../components/campaigns/RakshaBandhanTheme";

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
      <body className="min-h-screen flex flex-col relative">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <RakshaBandhanTheme />
        {children}
      </body>
    </html>
  );
}


