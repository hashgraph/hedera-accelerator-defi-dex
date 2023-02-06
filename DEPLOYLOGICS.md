## Deploy New contracts if logic is changed

1. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/upgrade-proxy.yml) 
2. Run this workflow `Automatically deploy on testnet if contract changed`
   This Action compares all previously deployed Contracts with latest implementation, and creates Upgrade proposal if finds any change.
3. Monitor the `Automatically deploy on testnet if contract changed` workflow.
4. Go to [Dex proposal list page](https://defi-ui.hedera.com/governance).
5. Open All Active proposals and Vote "Yes" on those proposals.
6. Go to [GitHub action page](https://github.com/hashgraph/hedera-accelerator-defi-dex/actions/workflows/execute-proposal.yml) 
7. Run this workflow `Execute proposals` with input parameters Branch and contract id e.g. Branch = `Develop` and contract id = `0.0.9049`. contract id is the currect UAT governorupgrade's transparentProxyId.
8. Monitor the `Execute proposals` workflow.
    This Actions excutes all the proposals which are Passed, and Deployes new logics of required contracts, and updates contracts.json and contractsUAT.json files.
