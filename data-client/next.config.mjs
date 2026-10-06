const nextConfig = {
  async headers() {
    // In production, Webflow designer extensions are served from various
    // Webflow-controlled origins. We allow all origins for the API routes
    // since authentication is handled via JWT tokens, not CORS.
    const allowedOrigin = process.env.DESIGNER_EXTENSION_URI || "*";

    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            value: allowedOrigin,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Authorization, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/:path*",
        has: [
          {
            type: "header",
            key: "Origin",
            value: "(?<origin>.*)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
