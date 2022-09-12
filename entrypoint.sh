#!/bin/sh

# Keep node alive
set -e
echo "********************  Env variables *********************"
COMMIT_MESSAGE=$1;
OPERATOR_ID=$2;
OPERATOR_KEY=$3;
ADMIN_ID=$2;
ADMIN_KEY=$3;
TREASURE_ID=$4;
TREASURE_KEY=$5;

echo COMMIT_MESSAGE $COMMIT_MESSAGE
echo OPERATOR_ID $OPERATOR_ID
echo TREASURE_ID $TREASURE_ID

npm --yes install --save-dev hardhat

echo "********************  Running test and coverage *********************"

npm run codecoverage;

echo "********************  Deployment *************************************"

msg=${COMMIT_MESSAGE:0:15};
echo "Checking for contract deployment " $msg;

if [ "$msg" = "Deploy contract" ]; then 
    CONTRACT_TO_DEPLOY=${COMMIT_MESSAGE:16};
    echo "Running contract deployment ........ " $CONTRACT_TO_DEPLOY;
    echo OPERATOR_ID=$OPERATOR_ID >> .env;
    echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
    echo ADMIN_ID=$ADMIN_ID >> .env;
    echo ADMIN_KEY=$ADMIN_KEY >> .env;
    contract=$CONTRACT_TO_DEPLOY.ts;
    npx hardhat run ./deployment/contract/$contract;
    echo "Deployment done.";
fi

msg=${COMMIT_MESSAGE:0:33};
echo "Checking for transparent proxy deployment " + $msg;

if [ "$msg" = "Deploy transparent proxy contract" ]; then 
    CONTRACT_NAME=${COMMIT_MESSAGE:34};
    echo "Running proxy deployment ........ " $CONTRACT_NAME;
    echo OPERATOR_ID=$OPERATOR_ID >> .env;
    echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
    echo ADMIN_ID=$ADMIN_ID >> .env;
    echo ADMIN_KEY=$ADMIN_KEY >> .env;
    echo TREASURE_ID=$TREASURE_ID >> .env;
    echo TREASURE_KEY=$TREASURE_KEY >> .env;
    echo CONTRACT_NAME=$CONTRACT_NAME >> .env;
    npx hardhat run ./deployment/contract/transparentUpgradeableProxy.ts;
    echo "Transparent proxy deployed.";
fi


msg=${COMMIT_MESSAGE:0:34};
echo "Checking for upgrade proxy logic contract " + $msg;

if [ "$msg" = "Upgrade transparent proxy contract" ]; then 
    CONTRACT_NAME=${COMMIT_MESSAGE:35};
    echo "Running upgrade logic contract ........ " $CONTRACT_NAME;
    echo OPERATOR_ID=$OPERATOR_ID >> .env;
    echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
    echo ADMIN_ID=$ADMIN_ID >> .env;
    echo ADMIN_KEY=$ADMIN_KEY >> .env;
    echo CONTRACT_NAME=$CONTRACT_NAME >> .env;
    npx hardhat run ./deployment/contract/upgradeProxy.ts;
    echo "Upgrade done.";
fi

echo "********************  Done *************************************"