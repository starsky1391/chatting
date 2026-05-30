import type { NextConfig } from "next";

const imageRemotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "http",
    hostname: "localhost",
    port: "3001",
    pathname: "/uploads/**",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "3001",
    pathname: "/uploads/**",
  },
  {
    protocol: "http",
    hostname: "backend",
    port: "3001",
    pathname: "/uploads/**",
  },
  {
    protocol: "https",
    hostname: "via.placeholder.com",
    pathname: "/**",
  },
];

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (configuredApiUrl?.startsWith("http")) {
  try {
    const url = new URL(configuredApiUrl);
    imageRemotePatterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/uploads/**",
    });
  } catch {
    // Ignore invalid build-time API URLs; the app still supports same-origin uploads.
  }
}

const configuredImageUrl = process.env.NEXT_PUBLIC_IMAGE_URL;
if (configuredImageUrl?.startsWith("http")) {
  try {
    const url = new URL(configuredImageUrl);
    imageRemotePatterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/uploads/**",
    });
  } catch {
    // Ignore invalid build-time image URLs; the app falls back to local backend hosts.
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  images: {
    dangerouslyAllowLocalIP: true,
    localPatterns: [
      {
        pathname: "/uploads/**",
      },
    ],
    remotePatterns: imageRemotePatterns,
    minimumCacheTTL: 60 * 60 * 24,
  },
};

export default nextConfig;
