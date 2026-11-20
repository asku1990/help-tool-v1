import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { SessionProvider } from 'next-auth/react';
import QueryProvider from './query-provider';

export const metadata: Metadata = {
  title: 'Car Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <QueryProvider>
            {/* Layout UI */}
            {/* Place children where you want to render a page or nested layout */}
            <main> {children}</main>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
