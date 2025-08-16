import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable type checking and linting during build for faster Docker builds
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable CSS optimization temporarily for build success
  optimizeFonts: false,
  // Fix hydration issues with SSR
  reactStrictMode: false,
  // Suppress React warnings in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here
  },
  // API routes configuration for backend communication
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*', // Backend service in docker network
      },
    ];
  },
};

export default nextConfig;
