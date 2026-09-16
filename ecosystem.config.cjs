/** PM2 — Next.js production (Next loads .env from project root automatically). */
module.exports = {
  apps: [
    {
      name: "xumarimodz",
      cwd: __dirname,
      // Run Next's bin directly (not via `npm start`) so PM2 cluster mode can
      // patch this process for port-sharing across workers — `npm` would fork
      // `next start` as a child process PM2 never instruments, and every
      // worker but the first would crash with EADDRINUSE.
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "cluster",
      instances: "max",
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
