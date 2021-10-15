require('dotenv').config()

module.exports = {
  apps : [{
    script: 'server.js',
    name: "chimeraContinuous",
    log: "./chimera.dev.log",
    watch: ['.'],
    ignore_watch: ["shared", "feed", "*.log", process.env.password_FILEPATH]
  }]
};
