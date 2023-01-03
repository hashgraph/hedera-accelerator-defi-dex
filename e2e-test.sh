#!/bin/sh

# Keep node alive
set -e
echo "********************  Env variables *********************"
CONTRACT_NAME=$1;
CONTRACT_TYPE=$2;
OPERATOR_ID=$3;
OPERATOR_KEY=$4;
ADMIN_ID=$3;
ADMIN_KEY=$4;
TREASURE_ID=$5;
TREASURE_KEY=$6;
TOKEN_USER_ID=$7;
TOKEN_USER_KEY=$8;

echo CONTRACT_NAME $CONTRACT_NAME
echo CONTRACT_TYPE $CONTRACT_TYPE
echo OPERATOR_ID $OPERATOR_ID
echo TREASURE_ID $TREASURE_ID
echo TOKEN_USER_ID $TOKEN_USER_ID


if [ "$CONTRACT_NAME" = "" ]; then
    echo "****************** Done ******************"; 
    exit 0;
fi

echo "********************  Deployment *************************************"

echo "Starting deployment for CONTRACT_NAME  " $CONTRACT_NAME;
echo "Starting deployment for CONTRACT_TYPE  " $CONTRACT_TYPE;

echo "Running contract deployment ........ " $CONTRACT_NAME;
echo CONTRACT_NAME=Pair >> .env;
npx hardhat run ./deployment/scripts/logic.ts;
npx hardhat run ./deployment/scripts/transparentUpgradeableProxy.ts;

sed -i~ '/^CONTRACT_NAME=/s/=.*/="LPToken"/' .env

npx hardhat run ./deployment/scripts/logic.ts;
npx hardhat run ./deployment/scripts/transparentUpgradeableProxy.ts;

npm run test

echo "********************  Done *************************************";