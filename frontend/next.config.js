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
        // Production: Elest.io, Local dev: localhost:3000
        const backendUrl = process.env.NODE_ENV === 'production'
            ? 'https://mooderi-u26413.vm.elestio.app'
            : (process.env.BACKEND_URL || 'http://127.0.0.1:3000');
        return [
            {
                // Proxy API calls to Node.js backend
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
