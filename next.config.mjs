/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          /**
           * geolocation + microphone are first-party only (they power "Use My
           * Precise Location" and the assistant's voice input). Camera stays off.
           * Google Maps needs its own origins for scripts/images.
           */
          { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=()' },
          ...(process.env.ARENA_PREVIEW === '1' ? [] : [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]),
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
};
export default nextConfig;
