const isVercel = Boolean(process.env.VERCEL);
// In Vercel serverless environment, 127.0.0.1:8000 does not exist.
// Only rewrite to local 127.0.0.1:8000 in local development (when not on Vercel and API_URL is unset).
const configuredApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
const apiTarget = configuredApiUrl || (isVercel ? null : "http://127.0.0.1:8000");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!apiTarget) {
      // On Vercel without an external API_URL, let Next.js App Router API route handlers handle requests
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
