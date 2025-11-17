import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWAProvider } from '@/app/page-view/pwa-provider'
import { Frame } from '@/app/page-view/frame'
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';


// ----------- Wallet ----------------
import DynamicWalletClientAuthProvider from "./page-view/page-component/handleWalletAuth";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL('https://vaneweb3.com'),
    title: "vaneweb3",
    description: "Your safety net for crypto transactions",
    appleWebApp: {
      capable: true,
      title: 'Vane Web3',
      statusBarStyle: 'black-translucent',
      startupImage: '/vane-logo.png',
    },
    openGraph: {
      title: "vaneweb3",
      description: "Your safety net for crypto transactions",
      images: [
        {
          url: "/vane-safety-net.png",
          width: 1200,
          height: 630,
          alt: "Vane Web3 - Your safety net for crypto transactions",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "vaneweb3",
      description: "Your safety net for crypto transactions",
      images: ["/vane-safety-net.png"],
    },
      other: {
      'fc:miniapp': JSON.stringify({
          version: 'next',
          imageUrl: 'https://vaneweb3.com/vane-safety-net.png',
          button: {
              title: `Protect your next transaction`,
              action: {
                  type: 'launch_miniapp',
                  name: 'Vane Web3',
                  url: 'https://vaneweb3.com',
                  splashImageUrl: 'https://vaneweb3.com/vane-logo.png',
                  splashBackgroundColor: '#0A1919',
              },
          },
      }),
      },
  };
}


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
        <DynamicWalletClientAuthProvider> 
          <PWAProvider />
          <Frame>
            {children}
            <Analytics />
          </Frame>
        </DynamicWalletClientAuthProvider>
        <Toaster 
          position="top-right" 
          theme="dark"
          duration={8000}
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
