import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone output for development hot reload
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  // Disable type checking and linting during build for faster Docker builds
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optimize for development
  optimizeFonts: false,
  reactStrictMode: false,
  
  // Hot reload configuration for Docker
  ...(process.env.NODE_ENV === 'development' && {
    webpack: (config, { dev }) => {
      if (dev) {
        // Enable polling for file watching in Docker
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
        };
      }
      return config;
    },
  }),
  
  // Suppress React warnings in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  
  // API routes configuration for backend communication
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // Backend service in docker network
      },
    ];
  },
};

export default nextConfig;
