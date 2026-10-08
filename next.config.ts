import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nonaktifkan static generation untuk route handlers dinamis
  // saat build (env validation/DB connection belum tersedia di CI).
  // Saat runtime via `next start` route handlers tetap aktif.
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
