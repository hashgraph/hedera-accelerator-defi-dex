#!/bin/sh

# Keep node alive
set -e
echo "Display context "
echo $1
COMMIT_MESSAGE=$1;
OPERATOR_ID=$2;
OPERATOR_KEY=$3;
ADMIN_ID=$2;
ADMIN_KEY=$3;
TREASURE_ID=$4;
TREASURE_KEY=$5;

echo $COMMIT_MESSAGE
echo $OPERATOR_ID
echo $OPERATOR_KEY

echo $TREASURE_ID
echo $TREASURE_KEY

npm --yes install --save-dev hardhat
# Run hardhat
npm run codecoverage;

if [ "$msg" = "Deploy contract" ]; then 
    CONTRACT_TO_DEPLOY=${COMMIT_MESSAGE:16};
    echo "Running contract deployment ........ " + CONTRACT_TO_DEPLOY;
    echo OPERATOR_ID=$OPERATOR_ID >> .env;
    echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
    echo ADMIN_ID=$ADMIN_ID >> .env;
    echo ADMIN_KEY=$ADMIN_KEY >> .env;
    cat .env;
    contract=$CONTRACT_TO_DEPLOY.ts;
    echo $contract;
    npx hardhat run ./deployment/$contract;
    echo "Deployment done.";
fi

msg=${COMMIT_MESSAGE:0:33};

echo "msg " + $msg;
if [ "$msg" = "Deploy transparent proxy contract" ]; then 
    CONTRACT_NAME=${COMMIT_MESSAGE:34};
    echo "Running proxy contract deployment ........ " + $CONTRACT_NAME;
    echo OPERATOR_ID=$OPERATOR_ID >> .env;
    echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
    echo ADMIN_ID=$ADMIN_ID >> .env;
    echo ADMIN_KEY=$ADMIN_KEY >> .env;
    echo TREASURE_ID=$TREASURE_ID >> .env;
    echo TREASURE_KEY=$TREASURE_KEY >> .env;
    echo CONTRACT_NAME=$CONTRACT_NAME >> .env;
    cat .env;
    npx hardhat run ./deployment/transparentUpgradeableProxy.ts;
    echo "Deployment done.";
fi

