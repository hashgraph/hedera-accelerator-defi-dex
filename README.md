# Project Setup -

## Run locally follow these instructions - Needs Node v16.15.1 and npm

[Follow this link to get context of HardHat](https://hardhat.org/getting-started)

Compile and run tests - 
```shell
npx hardhat compile
npx hardhat test
```
----

## Docker with command line -

### To just run test cases -
 ```shell
 docker build . --tag my-image-name:latest   
 docker run --env DEPLOY_ON_TESTNET=N --env CONTRACT_TO_DEPLOY=greetingContract  hhimage:latest
 ```

### To deploy contract as well -
 ```shell
 docker build . --tag my-image-name:latest   
 docker run --env DEPLOY_ON_TESTNET=Y --env CONTRACT_TO_DEPLOY=greetingContract  hhimage:latest
 ```
            
DEPLOY_ON_TESTNET
: is a variable and possible values are Y or N. Y deploys the contract on Hedera's testnet.

CONTRACT_TO_DEPLOY
: name of the contract to deploy.

----

## `Deploy contracts on testnet using gitHub actions`
Tests run before deploying the contract on testnet.

#### Normal contract

1. Create a deployment file under `./deployment/contract/` e.g. `./deployment/contract/swap.ts`
2. Commit file with commit message `Deploy contract <contract file name>`. e.g. `git commit -m "Deploy contract swap"`.
3. Push the changes
4. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions) 
5. Monitor the job `Deploy contract using node` 

####  Proxy contract

1. Commit your changes with commit message `Deploy transparent proxy contract <contract name>`. e.g. `git commit -m "Deploy transparent proxy contract swap"`.
2. Push the changes
3. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions) 
4. Monitor the job `Deploy contract using node` 

#### Upgrade implementation contract

1. Create new  version of contract 
2. Deploy the contract using above steps `Normal contract` 
3. Commit your changes with commit message `Upgrade transparent proxy contract <contract name> `. e.g. `git commit -m "Upgrade transparent proxy contract swap"`.
2. Push the changes
3. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions) 
4. Monitor the job `Deploy contract using node` 

-----
## [Contract Upgrade Strategy](./UPGRADE.md)
-----


## `Linter` -
* All *.sol files should be formatted with - NomicFoundation.hardhat-solidity
* Pls verify the default formatter is below under `/Users/<USER>/Library/Application\ Support/Code/User/settings.json`
* Please enable format on save settings in VS code - Code -> Preferences -> Settings -> Text Editor -> Formatting -> Format On Save



```
"[solidity]": {
        "editor.defaultFormatter": "NomicFoundation.hardhat-solidity"
    }
```
