module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: [
    "node_modules"
  ],
  coverageProvider: "babel",
  projects: [
    "<rootDir>/command/jest.config.js", 
    "<rootDir>/gateway/jest.config.js",
    "<rootDir>/lib/jest.config.js",
    "<rootDir>/livestream/jest.config.js",
    "<rootDir>/schedule/jest.config.js",
    "<rootDir>/storage/jest.config.js"
  ]
};
