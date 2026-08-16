/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three ships untranspiled ESM examples; keep them in the compile pipeline
  transpilePackages: ['three'],
};

export default nextConfig;
