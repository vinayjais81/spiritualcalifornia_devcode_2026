import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // ─── Permanent redirects ────────────────────────────────────────────
  // /travel-disclosures was the original route shipped 2026-05-21; the
  // compliance implementation spec (2026-05-22) renamed the canonical
  // URL to /disclosures. We keep a 301 here so any inbound link, search
  // result, or printed receipt that still uses the old URL resolves
  // correctly.
  async redirects() {
    return [
      {
        source: '/travel-disclosures',
        destination: '/disclosures',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
