import HomeClient from '@/components/home/HomeClient';

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'JeevanSetu',
    url: 'https://www.jeevansetu.in',
    description: 'Find nearby hospitals, compare facilities and estimate treatment costs across India.',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.jeevansetu.in/hospitals?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeClient />
    </>
  );
}
