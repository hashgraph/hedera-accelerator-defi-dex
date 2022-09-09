const https = require('https');

export function httpRequest(contractEvmAddress, postData) {

  const options = {
    hostname: 'testnet.mirrornode.hedera.com',
    port: 443,
    path: '/api/v1/contracts/' + contractEvmAddress,
    method: 'GET',
  };

  return new Promise(function(resolve, reject) { 
      var req = https.request(options, function(res) {
          // reject on bad status
          if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error('statusCode=' + res.statusCode));
          }
          // cumulate data
          var body = [];
          res.on('data', function(chunk) {
              body.push(chunk);
          });
          // resolve on end
          res.on('end', function() {
              try {
                  body = JSON.parse(Buffer.concat(body).toString());
              } catch(e) {
                  reject(e);
              }
              resolve(body);
          });
      });
      // reject on request error
      req.on('error', function(err) {
          // This is not a "Second reject", just a different sort of failure
          reject(err);
      });
      if (postData) {
          req.write(postData);
      }
      // IMPORTANT
      req.end();
  });
}

async function main() {
  const response = await httpRequest("0x0000000000000000000000000000000002dfa2d5");  
  const id = response.contract_id;
  console.log(`id ${id}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });