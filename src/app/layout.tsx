import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '2ndCFO · AI Finance & Budgeting',
  description: 'Upload, review and reconcile your company finances.',
  icons: { icon: '/creatiq-ai-logo.jpeg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
