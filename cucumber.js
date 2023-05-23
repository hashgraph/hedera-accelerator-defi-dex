let common = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
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

let testSuite3 = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@TestSuite-3'
].join(' ');

let testSuite4 = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@TestSuite-4'
].join(' ');

let testSuite5 = [
  'e2e-test/features/**/*.feature',
  '--require-module ts-node/register',
  '--require e2e-test/step-definitions/**/*.ts',
  '--publish',
  '--tags=@TestSuite-5'
].join(' ');

module.exports = {
  default: common,
  suiteOne: testSuite1,
  suiteTwo: testSuite2,
  suiteThree: testSuite3,
  suiteFour:testSuite4,
  suiteFive:testSuite5
  // More profiles can be added if desired
};