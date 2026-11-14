'use client';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type MapView from './MapView';
import { useLang } from '@/lib/i18n';

function MapLoadingPlaceholder() {
  const { t } = useLang();
  return (
    <div className="h-72 sm:h-96 w-full rounded-2xl border border-brand-100 bg-brand-50 flex items-center justify-center text-brand-800 font-semibold animate-pulse">
      {t('loadingMap')}
    </div>
  );
}

const MapViewLazy = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

export default function MapViewClient(props: ComponentProps<typeof MapView>) {
  return <MapViewLazy {...props} />;
}
