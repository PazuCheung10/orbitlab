/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Keep old link working, but make the canonical URL be "/"
      {
        source: '/motion-canvas',
        destination: '/',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig

