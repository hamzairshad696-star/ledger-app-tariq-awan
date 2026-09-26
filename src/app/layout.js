import './globals.css';

export const metadata = {
  title: 'Ledger — Tariq Awan',
  description: 'Private ledger management',
  robots: { index: false, follow: false, nocache: true },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0E1F3D' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
