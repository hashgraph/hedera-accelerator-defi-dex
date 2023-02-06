## Deploy New contracts if logic is changed

### Note
    Whenever a new PR merges to Develop, `Automatically deploy on testnet if contract changed` Action gets triggered, which creates Proposals for all the changed Smart Contracts. If it contains changes in governorupgrade in addition to the other Smart Contracts, we are to follow below steps 1 more time manually.

1. If a New PR is merged in Develop, GoTo step 3, else if you want to manually run work flow go to step 2.

2. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/upgrade-proxy.yml) 

3. Run this workflow `Automatically deploy on testnet if contract changed`.
    This Action compares all previously deployed Contracts with latest implementation, and creates Upgrade proposal if finds any change.

4. Monitor the `Automatically deploy on testnet if contract changed` workflow.
5. Go to [Dex proposal list page](https://defi-ui.hedera.com/governance).

6. Open All Active proposals and Vote "Yes" on those proposals.(Do Not Vote for Contract Name: "governorupgrade", GoTo step 10).

7. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/execute-proposal.yml) 
8. Run this workflow `Execute proposals` with input parameters Branch and contract id e.g. Branch = `Develop` and contract id = `0.0.9049`. contract id is the currect UAT governorupgrade's transparentProxyId.
9. Monitor the `Execute proposals` workflow.
    This Actions excutes all the proposals which are Passed, and Deployes new logics of required contracts, and updates contracts.json and contractsUAT.json files.
10. In case there was a proposal for Contract Name= "governorupgrade", start from step 1 again after a new commit of json file update is available on Develop.
