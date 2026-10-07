const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
  poweredByHeader: false,
  serverExternalPackages: ["redis"],
};

export default nextConfig;
