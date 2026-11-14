import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SkipLink from '@/components/SkipLink';
import ChatbotWidget from '@/components/ChatbotWidget';
import { LanguageProvider } from '@/lib/i18n';
import { LocationProvider } from '@/lib/useLocation';
import { CompareProvider } from '@/lib/compare';
import { SavedProvider } from '@/lib/saved';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.jeevansetu.in'),
  title: {
    default: 'JeevanSetu — Find the Right Hospital Near You | Free Healthcare Assistance India',
    template: '%s | JeevanSetu',
  },
  description:
    'JeevanSetu helps families across India find nearby hospitals, check road travel time, compare facilities and transparent community ratings, estimate treatment costs in ₹ and reach 24×7 emergency care across 11 languages.',
  keywords: [
    'hospitals near me',
    'government hospital',
    'treatment cost India',
    'emergency hospital',
    'hospital community ratings India',
    'JeevanSetu',
    'अस्पताल खोज',
  ],
  applicationName: 'JeevanSetu',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'JeevanSetu',
    title: 'JeevanSetu — The Right Hospital, Closer to You',
    description:
      'Find nearby hospitals, view transparent community ratings, estimate treatment costs and reach 24×7 emergency support in 11 languages.',
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
    <html lang="en" dir="ltr">
      <body className="min-h-screen flex flex-col">
        <LanguageProvider>
          <LocationProvider>
            <CompareProvider>
              <SavedProvider>
                <SkipLink />
                <Header />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
                <Footer />
                <ChatbotWidget />
              </SavedProvider>
            </CompareProvider>
          </LocationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
