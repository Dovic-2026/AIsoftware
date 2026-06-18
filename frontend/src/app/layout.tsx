"use client";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
  }));

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <title>DOVIC AI Restaurant OS</title>
        <meta name="description" content="Manage your restaurant via WhatsApp" />
        <meta name="theme-color" content="#075E54" />
        <link rel="manifest" href="/manifest.json" />
        {/* PWA iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DOVIC AI" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
