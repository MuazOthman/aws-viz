module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended'],
  testPathIgnorePatterns: ['/node_modules/'],
  // testResultsProcessor: 'jest-sonar-reporter',
  coveragePathIgnorePatterns: ['/node_modules/', 'test.ts', 'spec.ts'],
};
