module.exports = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: [
    "node_modules"
  ],
  coverageProvider: "babel",
  moduleFileExtensions: [
    "js",
    "jsx",
    "json"
  ],
  projects: [{
    displayName: "command",
    testMatch: ["<rootDir>/command/**/*.test.js"],
    setupFiles: ["dotenv/config"]
  },{
    displayName: "gateway",
    testMatch: ["<rootDir>/gateway/**/*.test.js"],
    setupFiles: ["dotenv/config"]
  },{
    displayName: "lib",
    testMatch: ["<rootDir>/lib/**/*.test.js"],
    setupFiles: ["dotenv/config"]
  },{
    displayName: "livestream",
    testMatch: ["<rootDir>/livestream/**/*.test.js"],
    setupFiles: ["dotenv/config"]
  },{
    displayName: "schedule",
    testMatch: ["<rootDir>/schedule/**/*.test.js"],
    setupFiles: ["dotenv/config"]
  },{
    displayName: "storage",
    testMatch: ["<rootDir>/storage/**/*.test.js"],
    setupFiles: ["dotenv/config"]
  }],
  testTimeout: 10000
};
