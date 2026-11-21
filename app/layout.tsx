import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SkipLink from '@/components/SkipLink';
import AssistantLauncher from '@/components/assistant/AssistantLauncher';
import { LanguageProvider } from '@/lib/i18n';
import { LocationProvider } from '@/lib/useLocation';
import { CompareProvider } from '@/lib/compare';
import { SavedProvider } from '@/lib/saved';
import { TreatmentProvider } from '@/lib/treatment-selection';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.jeevansetu.in'),
  title: {
    default: 'JeevanSetu — Find the Right Hospital Near You | Free Healthcare Assistance India',
    template: '%s | JeevanSetu',
  },
  description:
    'JeevanSetu helps families across India find nearby hospitals without sharing their location, compare facilities, estimate treatment costs in ₹ and reach emergency assistance.',
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
      'Find nearby hospitals, view transparent community ratings, estimate treatment costs and reach 24×7 emergency support.',
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
                <TreatmentProvider>
                <SkipLink />
                <Header />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
                <Footer />
                <AssistantLauncher />
                </TreatmentProvider>
              </SavedProvider>
            </CompareProvider>
          </LocationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
