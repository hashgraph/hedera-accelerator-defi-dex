const {
  spawn
} = require('child_process')

// your cmd to start the process, possibly spawn('npm.cmd', ['test'))
const proc = spawn('npm',['test'])
let timer = null
proc.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`)
  // look for the string in stdout
  if (data.includes('View your Cucumber Report at')) {
    console.log('test run completed')   
      setTimeout(() => {
        proc.child.kill('SIGINT')
      }, 1000)
    
  }
})

proc.stderr.on('data', (data) => {
  clearTimeout(timer)
  console.error(`stderr: ${data}`)
  if (data.includes('View your Cucumber Report at')) {  
    console.log('test run completed')      
      setTimeout(() => {
        proc.child.kill()
      }, 1000)
    
  }
});

proc.on('close', (code) => {
  clearTimeout(timer)
  console.log(`child process exited with code ${code}`);
});

process
  .on('SIGTERM', shutdown('SIGTERM'))
  .on('SIGINT', shutdown('SIGINT'))
  .on('uncaughtException', shutdown('uncaughtException'))

function shutdown(signal) {
  return (err) => {
    console.log(`\n${signal} signal received.`)
    console.log('Killing child process.')
    proc.child.kill()
  }
}