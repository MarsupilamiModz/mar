/** PM2 — Next.js production (Next loads .env from project root automatically). */
module.exports = {
  apps: [
    {
      name: "xumarimodz",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 10000,
    },
  ],
};
