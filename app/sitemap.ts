import type { MetadataRoute } from 'next';
import { HOSPITALS } from '@/data/hospitals';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.jeevansetu.in';
  const staticPages = ['', '/hospitals', '/rankings', '/recommendations', '/cost-estimator', '/compare', '/emergency', '/about', '/contact', '/privacy', '/disclaimer'].map((p) => ({
    url: `${base}${p}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.8,
  }));
  const hospitalPages = HOSPITALS.map((h) => ({
    url: `${base}/hospitals/${h.id}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6,
  }));
  return [...staticPages, ...hospitalPages];
}
