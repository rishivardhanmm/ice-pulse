/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Node-only libraries must not be bundled for the browser/edge. Keeping them
  // external ensures the MSSQL driver and Google Ads client run in the Node runtime.
  experimental: {
    serverComponentsExternalPackages: [
      'mssql',
      'tedious',
      'msnodesqlv8',
      'google-ads-api',
      'google-auth-library',
    ],
    // Lets instrumentation.ts run at server boot (starts the sync scheduler).
    instrumentationHook: true,
  },
};

export default nextConfig;
