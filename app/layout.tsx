import React from 'react';
import './globals.css';
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {/* Layout UI */}
          {/* Place children where you want to render a page or nested layout */}
          <main> {children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
