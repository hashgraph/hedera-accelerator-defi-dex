const { spawn } = require("child_process");
const E2E_FAILED_CODE_REGEX = /(\d+) steps \((\d+) failed\.*/;
const args = process.argv.slice(2);
// your cmd to start the process, possibly spawn('npm.cmd', ['test')) for win

const suiteName = args[0];
const proc = spawn("npm", ["run", suiteName]); // change it to npm for linux
let flag = false;
proc.stdout.on("data", (data) => {
  if (E2E_FAILED_CODE_REGEX.exec(data)) {
    flag = true;
  }
  if (data.includes("View your Cucumber Report at")) {
    console.log("test run completed");
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  }
});

proc.stderr.on("data", (data) => {
  console.error(`stderr: ${data}`);
  if (data.includes("View your Cucumber Report at")) {
    if (!flag) {
      console.log("test run completed");
      setTimeout(() => {
        process.exit(0);
      }, 5000);
    } else {
      console.log("few test cases failed");
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  }
});
