require('dotenv').config()

module.exports = {
  apps : [{
    script: 'server.js',
    name: "chimeraContinuous",
    log: "./chimera.log",
    watch: ['.'],
    ignore_watch: ["shared", "./chimera.log", process.env.passwordPath]
  }]
};
