import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Temporary: don't fail production builds on ESLint errors
    // Several pre-existing files trigger lint errors unrelated to this change
    // ignoreDuringBuilds: true,
  },
};

export default nextConfig;
