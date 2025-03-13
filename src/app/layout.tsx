import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWAProvider } from '@/app/page-view/pwa-provider'
import { Frame } from '@/app/page-view/frame'
import { Toaster } from 'sonner';

// ----------- Wallet ----------------
import ClientAuthProvider from "./page-view/page-component/handleWalletAuth";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vaneweb3",
  description: "Safety net for web3 transfers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientAuthProvider> {/* ✅ Move logic to Client Component */}
          <PWAProvider />
          <Frame>{children}</Frame>
        </ClientAuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
