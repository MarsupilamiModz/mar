/** PM2 config — loads .env and binds Next.js to IPv4 only. */
module.exports = {
  apps: [
    {
      name: "xumarimodz",
      cwd: __dirname,
      script: "./scripts/start-production.sh",
      interpreter: "bash",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
