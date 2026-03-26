/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  experimental: {
    middlewareClientMaxBodySize: "50mb"
  }
};

export default nextConfig;
