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

    // Optimize chunk loading in development
    webpack: (config, { dev }) => {
        if (dev) {
            // Increase timeout for chunk loading in dev
            config.output.chunkLoadTimeout = 60000; // 60 seconds
        }
        return config;
    },

    // Reduce source map generation in dev for faster builds
    productionBrowserSourceMaps: false,
};

module.exports = nextConfig;


