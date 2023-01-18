const {
  spawn
} = require('child_process')

// your cmd to start the process, possibly spawn('npm.cmd', ['test'))
const proc = spawn('npm',['test'])
let flag = false;
proc.stdout.on('data', (data) => {
  if(data.includes('failed')){
    flag = true;
  }
  console.log(`stdout: ${data}`)
  if (data.includes('View your Cucumber Report at')) {
    console.log('test run completed')
    setTimeout(() => {process.exit(0);}, 5000);        
  }
  
})

proc.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`)
  if (data.includes('View your Cucumber Report at')) {
    if(!flag){
    console.log('test run completed')
    setTimeout(() => {process.exit(0);}, 5000);   
    }
    else{
      console.log('few test cases failed')
      setTimeout(() => {process.exit(1);}, 5000);
    }     
  }
});
