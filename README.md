# Project Setup -

## Run locally follow these instructions - Needs Node v16.15.1 and npm

[Follow this link to get context of HardHat](https://hardhat.org/getting-started)

Compile and run tests - 
```shell
npx hardhat compile
npx hardhat test
```
----

## `Deploy existing contracts on testnet using gitHub actions`
Tests run before deploying the contract on testnet.

#### Normal contract

1. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/deploy-contract-github.yml)
2. Run this workflow `Deploy a contract to testnet using dispatch` with input parameters contract name and type e.g. contract name = `factory` and contract type = `Logic`. Both name and type are case sensitive.
3. Monitor the job `Deploy a contract to testnet using dispatch` 

####  Proxy contract

1. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/deploy-contract-github.yml)
2. Run this workflow `Deploy a contract to testnet using dispatch` with input parameters contract name and type e.g. contract name = `factory` and contract type = `Proxy`. Both name and type are case sensitive.
3. Monitor the job `Deploy a contract to testnet using dispatch` 

#### Upgrade implementation contract

1. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/deploy-contract-github.yml)
2. Run this workflow `Deploy a contract to testnet using dispatch` with input parameters contract name and type e.g. contract name = `factory` and contract type = `Logic`. Both name and type are case sensitive.
3. Monitor the job `Deploy a contract to testnet using dispatch`
4. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/deploy-contract-github.yml)
5. Run this workflow `Deploy a contract to testnet using dispatch` with input parameters contract name and type e.g. contract name = `factory` and contract type = `Upgrade`. Both name and type are case sensitive.
6. Monitor the job `Deploy a contract to testnet using dispatch`

----

## `Deploy contracts on testnet using command line`
### New contract (one time setup needed)
1. Go to [here](./deployment/contract/deploy.ts)
2. Add new contract name in SUPPORTED_CONTRACTS_FOR_DEPLOYMENT
3. `run command` npx hardhat run deployment/contract/deploy.ts 

### Existing contract
`run command` npx hardhat run deployment/contract/deploy.ts 

once above command executed, it will show options to execute required flow.
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
