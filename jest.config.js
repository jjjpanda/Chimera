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
  setupFiles: ["dotenv/config"]
};
