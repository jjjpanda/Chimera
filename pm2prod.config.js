module.exports = {
  apps : [{
    script: 'server.js',
    name: "chimera",
    log: "./chimera.log",
    log_date_format:"YYYY-MM-DD HH:mm:ss",
    env: {
      "NODE_ENV": "production",
    }
  }]
};
