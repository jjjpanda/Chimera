module.exports = {
  apps : [{
    script: 'server.js',
    name: "chimera",
    log: "./chimera.log",
    env: {
      "NODE_ENV": "production",
    }
  }]
};
