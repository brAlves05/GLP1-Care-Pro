import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GLP-1 Care Pro',
  description: 'Plataforma clínica para acompanhamento de tratamentos agonistas GLP-1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
