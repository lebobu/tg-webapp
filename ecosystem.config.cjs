// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "tg-webapp-bot",
      script: "./server.js",
      cwd: "/root/tg-webapp",
      watch: false, // or true if you want auto-reload on changes
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
