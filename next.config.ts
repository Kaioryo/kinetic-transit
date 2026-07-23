import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        // sw.js WAJIB no-cache: tanpa ini, browser/CDN bisa terus menyajikan
        // versi lama dari cache-nya sendiri, sehingga perbaikan pada service
        // worker tidak pernah benar-benar sampai ke pengguna walau sudah di-deploy.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
