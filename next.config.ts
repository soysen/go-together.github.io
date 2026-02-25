import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';
const basePath = isDev ? '' : (process.env.NEXT_PUBLIC_BASE_PATH || '');

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
};

export default nextConfig;
