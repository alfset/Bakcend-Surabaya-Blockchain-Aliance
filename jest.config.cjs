module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest', // Transform all JS files using Babel
  },
  moduleFileExtensions: ['js', 'json', 'node'],
};
