import type { MetadataRoute } from 'next';
import { HOSPITALS } from '@/data/hospitals';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  const staticPages = ['', '/hospitals', '/recommendations', '/cost-estimator', '/compare', '/emergency', '/about', '/contact', '/privacy', '/disclaimer'].map((p) => ({
    url: `${base}${p}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.8,
  }));
  const hospitalPages = HOSPITALS.map((h) => ({
    url: `${base}/hospitals/${h.id}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6,
  }));
  return [...staticPages, ...hospitalPages];
}
