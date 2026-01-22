import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Web Compare - File Comparison Tool',
  description: 'A powerful web-based file comparison tool like Beyond Compare. Compare text, code, binary files, and directories.',
  keywords: ['file comparison', 'diff', 'merge', 'beyond compare', 'code comparison'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
