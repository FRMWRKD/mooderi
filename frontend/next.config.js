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
        // LOCAL_BACKEND_URL takes priority for local dev, otherwise use NEXT_PUBLIC_BACKEND_URL or fallback
        const backendUrl = process.env.LOCAL_BACKEND_URL
            || (process.env.NODE_ENV === 'development' ? 'http://localhost:6030' : null)
            || process.env.NEXT_PUBLIC_BACKEND_URL
            || process.env.BACKEND_URL
            || 'https://mooderi-u26413.vm.elestio.app';
        console.log('Backend URL for rewrites:', backendUrl);
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


