/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Отключаем Turbopack из-за проблем с кириллицей в пути
  experimental: {
    turbo: false,
  },
}

export default nextConfig

