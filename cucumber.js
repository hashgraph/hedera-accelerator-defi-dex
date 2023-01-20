let common = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@Pair'
].join(' ');

module.exports = {
  default: common,
  // More profiles can be added if desired
};