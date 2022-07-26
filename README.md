# Basic Sample Hardhat Project -

## Run locally follow these instructions - Needs Node v16.15.1  and npm

[Follow this link to get context of HardHat](https://hardhat.org/getting-started)

Compile and run tests - 
```shell
npx hardhat compile
npx hardhat test
```

## Docker with command line -

###To just run test cases -
 ```shell
 docker build . --tag my-image-name:latest   
 docker run --env DEPLOY_ON_TESTNET=N --env CONTRACT_TO_DEPLOY=greetingContract  hhimage:latest
 ```

###To deploy contract as well -
 ```shell
 docker build . --tag my-image-name:latest   
 docker run --env DEPLOY_ON_TESTNET=Y --env CONTRACT_TO_DEPLOY=greetingContract  hhimage:latest
 ```
            
DEPLOY_ON_TESTNET
: is a variable and possible values are Y or N. Y deploys the contract on Hedera's testnet.

CONTRACT_TO_DEPLOY
: name of the contract to deploy.

-----
##GitHub Actions 
### For contract deployment -
1. [Contract can also be deployed using GitHubAction's this link.](https://github.com/amandeeprehal-lab49/SmartContracts/actions/workflows/deploy-contract.yml)

2. Click on "Run workflow" and pass the contract name(case sensitive) e.g. greetingContract
-----
