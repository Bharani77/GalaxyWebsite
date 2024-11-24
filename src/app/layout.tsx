import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { SessionProvider } from './SessionProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Galaxy Kick Lock',
  description: 'Secure gaming authentication platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '2px solid #9333ea',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
