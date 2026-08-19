/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Only apply the dynamic path correction block to client-side bundles
    if (!isServer) {
      config.output.publicPath = 'auto'; // Automatically calculates directory depth natively
    }
    return config;
  }
};

export default nextConfig;