#!/bin/sh
# Change to the correct directory
cd /app;

# Keep node alive
set -e

npm config set strict-ssl false --global;
export NODE_TLS_REJECT_UNAUTHORIZED='0';
npm --yes install --save-dev hardhat
# Run hardhat
npm run codecoverage;
msg=${COMMIT_MESSAGE:0:15};
echo "msg " + $msg;

if [ "$msg" = "Deploy contract"]; then 
    CONTRACT_TO_DEPLOY=${COMMIT_MESSAGE:16};
    echo "Running contract deployment ........ " + CONTRACT_TO_DEPLOY;
    contract=$CONTRACT_TO_DEPLOY.ts;
    echo $contract;
    npx hardhat run ./deployment/$contract;
    echo "Deployment done.";
fi


msg=${COMMIT_MESSAGE:0:33};

echo "msg " + $msg;
if [ "$msg" = "Deploy transparent proxy contract"]; then 
    CONTRACT_TO_DEPLOY=${COMMIT_MESSAGE:34};
    echo "Running proxy contract deployment ........ " + CONTRACT_TO_DEPLOY;
    echo OPERATOR_ID=$OPERATOR_ID >> .env;
    echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
    echo ADMIN_ID=$ADMIN_ID >> .env;
    echo ADMIN_KEY=$ADMIN_KEY >> .env;
    echo TREASURE_ID=$TREASURE_ID >> .env;
    echo TREASURE_KEY=$TREASURE_KEY >> .env;
    echo CONTRACT_ADDRESS=$CONTRACT_ADDRESS >> .env;
    echo ADMIN_ADDRESS=$ADMIN_ADDRESS >> .env;
    cat .env;
    npx hardhat run ./deployment/transparentUpgradeableProxy.ts;
    echo "Deployment done.";
fi