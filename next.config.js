/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // No longer needed after Next.js 13.5.0
    // appDir: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Disable caching in development
    if (dev) {
      config.cache = false;
    }
    return config;
  }
};

module.exports = nextConfig; 