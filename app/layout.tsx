import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SkipLink from '@/components/SkipLink';
import { LanguageProvider } from '@/lib/i18n';
import { CompareProvider } from '@/lib/compare';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.jeevansetu.in'),
  title: {
    default: 'JeevanSetu — Find the Right Hospital Near You | Free Healthcare Assistance India',
    template: '%s | JeevanSetu',
  },
  description:
    'JeevanSetu helps rural families find nearby hospitals, compare government and private facilities, estimate treatment costs in ₹ and reach emergency care. Free, in Hindi and English, no account needed.',
  keywords: ['hospitals near me', 'government hospital', 'treatment cost India', 'emergency hospital', 'healthcare rural India', 'अस्पताल खोज'],
  applicationName: 'JeevanSetu',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'JeevanSetu',
    title: 'JeevanSetu — The Right Hospital, Closer to You',
    description: 'Find nearby hospitals, understand treatment costs and make informed healthcare decisions for your family.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1b5e45',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <LanguageProvider>
          <CompareProvider>
            <SkipLink />
            <Header />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </CompareProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
