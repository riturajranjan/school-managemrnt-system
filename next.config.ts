import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma + the native `pg` driver out of the server bundle so they run
  // from node_modules at runtime (native bindings must not be bundled).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  async redirects() {
    return [
      // The old mock Job Openings pages (db.recruitmentJobs) were removed in
      // favor of the real /hr/recruitment page (Phase B, HR Sub-batch 4).
      // Old job ids don't map to real JobOpening ids, so every variant lands
      // on the canonical listing rather than a 404.
      { source: "/hr/recruitment/jobs", destination: "/hr/recruitment", permanent: false },
      { source: "/hr/recruitment/jobs/new", destination: "/hr/recruitment", permanent: false },
      { source: "/hr/recruitment/jobs/:jobId", destination: "/hr/recruitment", permanent: false },
    ];
  },
};

export default nextConfig;
