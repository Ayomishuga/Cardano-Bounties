/** @type {import('next').NextConfig} */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig= {
    serverExternalPackages: ['@meshsdk/core', '@meshsdk/core-csl'],
    images: {
        remotePatterns: supabaseHostname
            ? [
                {
                    protocol: 'https',
                    hostname: supabaseHostname,
                    pathname: '/storage/v1/object/public/**',
                },
            ]
            : [],
    },
    serverComponentsExternalPackages: ['@meshsdk/core', '@meshsdk/core-csl'],
    turbopack: {},
    webpack: (config) => {
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
        }
        config.module.rules.push({
            test: /\.wasm$/,
            type: 'webassembly/async',
        })
        return config
    }
};

export default nextConfig;
