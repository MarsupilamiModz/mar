/** PM2 config — bind Next.js to IPv4 only (matches nginx upstream). */
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
        HOSTNAME: "127.0.0.1",
      },
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
