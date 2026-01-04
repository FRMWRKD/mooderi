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
        // LOCAL_BACKEND_URL takes priority for local dev, otherwise use BACKEND_URL or fallback
        const backendUrl = process.env.LOCAL_BACKEND_URL
            || (process.env.NODE_ENV === 'development' ? 'http://localhost:6030' : null)
            || process.env.BACKEND_URL
            || 'http://localhost:6030';
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


