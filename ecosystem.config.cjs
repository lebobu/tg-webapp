// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "tgwatest-bot",
      script: "./server.js",
      cwd: "/root/tg-webapp-test",
      watch: false, // or true if you want auto-reload on changes
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
