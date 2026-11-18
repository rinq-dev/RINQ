/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
