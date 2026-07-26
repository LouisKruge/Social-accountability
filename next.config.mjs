/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // The sections were renamed to what they emotionally do. Keep old links alive.
    return [
      { source: "/challenges", destination: "/commit", permanent: false },
      { source: "/challenges/:path*", destination: "/commit/:path*", permanent: false },
      { source: "/glow-up", destination: "/elevate", permanent: false },
      { source: "/glow-up/:path*", destination: "/elevate/:path*", permanent: false },
      { source: "/profile", destination: "/you", permanent: false },
    ];
  },
};

export default nextConfig;
