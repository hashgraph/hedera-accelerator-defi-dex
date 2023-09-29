const COMMON = [
  "e2e-test/features/**/*.feature",
  "--require-module ts-node/register",
  "--require e2e-test/step-definitions/**/*.ts",
  "--publish",
];
const testSuite1 = [...COMMON, "--tags=@TestSuite-1"];
const testSuite2 = [...COMMON, "--tags=@TestSuite-2"];
const testSuite3 = [...COMMON, "--tags=@TestSuite-3"];
const testSuite4 = [...COMMON, "--tags=@TestSuite-4"];
const testSuite5 = [...COMMON, "--tags=@TestSuite-5"];
const testSuite6 = [...COMMON, "--tags=@TestSuite-6"];
const testSuite7 = [...COMMON, "--tags=@TestSuite-7"];
const testSuite8 = [...COMMON, "--tags=@TestSuite-8"];
const testSuite9 = [...COMMON, "--tags=@TestSuite-9"];

module.exports = {
  default: COMMON.join(" "),
  suiteOne: testSuite1.join(" "),
  suiteTwo: testSuite2.join(" "),
  suiteThree: testSuite3.join(" "),
  suiteFour: testSuite4.join(" "),
  suiteFive: testSuite5.join(" "),
  suiteSix: testSuite6.join(" "),
  suiteSeven: testSuite7.join(" "),
  suiteEight: testSuite8.join(" "),
  suiteNine: testSuite9.join(" "),
  // More profiles can be added if desired
};
