const {
  spawn
} = require('child_process')

// your cmd to start the process, possibly spawn('npm.cmd', ['test'))
const proc = spawn('npm.cmd',['test'])
proc.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`)
  if (data.includes('View your Cucumber Report at')) {
    console.log('test run completed')
    process.exit(0) 
      
  }
})

proc.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`)
  if (data.includes('View your Cucumber Report at')) {  
    console.log('test run completed')      
    process.exit(0);   
    
  }
});
