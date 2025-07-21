const config = {
  requireModule: ['@babel/register'],
  require: [
    'src/support/hooks.js',
    'src/support/world.js',
    'src/steps/step_definitions/**/*.js'
  ],
  format: [
    'progress',
    'summary',
    'json:reports/cucumber-report.json'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  paths: ['src/features/**/*.feature'],
  parallel: 1
};

module.exports = config;