/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Используем только app/ директорию, игнорируем src/pages
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig

