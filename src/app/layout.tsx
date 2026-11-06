import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mailbox Order Manager',
  description: 'Pre-warmed Google and Microsoft mailboxes order management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

