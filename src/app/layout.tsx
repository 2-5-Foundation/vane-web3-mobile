import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWAProvider } from '@/app/page-view/pwa-provider'
import { Frame } from '@/app/page-view/frame'
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';


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
      <head>
        {/* iOS PWA icon */}
        <link rel="apple-touch-icon" href="/vane-logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0B1B1C" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ClientAuthProvider> 
          <PWAProvider />
          <Frame>
            {children}
            <Analytics />
          </Frame>
        </ClientAuthProvider>
        <Toaster 
          position="top-right" 
          theme="dark"
          duration={5000}
          closeButton
          toastOptions={{
            style: {
              background: '#0D1B1B',
              border: '1px solid rgba(74, 88, 83, 0.2)',
              color: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            },
            className: 'toast-custom',
          }}
        />
      </body>
    </html>
  );
}
