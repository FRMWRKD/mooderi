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

    experimental: {
        outputFileTracingExcludes: {
            '*': ['**/._*']
        }
    },
};

module.exports = nextConfig;


