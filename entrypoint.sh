#!/bin/sh
# Change to the correct directory
cd /app;

# Keep node alive
set -e

npm config set strict-ssl false --global;
export NODE_TLS_REJECT_UNAUTHORIZED='0';
npm --yes install --save-dev hardhat
# Run hardhat
# npm run runtest;
# npm run codecoverage;

if [ "$DEPLOY_ON_TESTNET" = "Y" ]; then
    echo "Running contract deployment ........ ";
    contract=$CONTRACT_TO_DEPLOY.ts;
    echo $contract;
    npx hardhat run ./deployment/$contract;
    echo "Deployment done.";
fi
