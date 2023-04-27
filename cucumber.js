let common = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@Pair'
].join(' ');

let testSuite1 = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@TestSuite-1'
].join(' ');

let testSuite2 = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@TestSuite-2'
].join(' ');

module.exports = {
  default: common,
  suiteOne: testSuite1,
  suiteTwo: testSuite2
  // More profiles can be added if desired
};