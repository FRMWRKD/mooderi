/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                // Proxy API calls to Flask backend
                source: '/api/:path*',
                destination: 'http://127.0.0.1:8000/api/:path*',
            },
        ];
    },
};

module.exports = nextConfig;
