import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import { MainLayout } from '@/components/layout/main-layout';
import { AuthProvider } from '@/components/providers/AuthProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Suradkar Hospital - Smart Clinic Management',
  description: 'Manage your clinic efficiently with Suradkar Hospital.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased text-slate-900" suppressHydrationWarning>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
