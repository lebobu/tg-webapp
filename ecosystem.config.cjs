// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "tg-webapp-dev-bot",
      script: "./server.js",
      cwd: "/var/www/site-dev",
      watch: false, // or true if you want auto-reload on changes
      env: {
        NODE_ENV: "dev"
      }
    }
  ]
};

