#!/bin/sh

# Keep node alive
set -e
echo "********************  Env variables *********************"
OPERATOR_ID=$1;
OPERATOR_KEY=$2;
ADMIN_ID=$1;
ADMIN_KEY=$2;
TREASURE_ID=$3;
TREASURE_KEY=$4;
TOKEN_USER_ID=$5;
TOKEN_USER_KEY=$6;

echo OPERATOR_ID $OPERATOR_ID
echo TREASURE_ID $TREASURE_ID
echo TOKEN_USER_ID $TOKEN_USER_ID

echo "********************  Running test and coverage *********************"

npm run codecoverage;

echo "********************  Deployment *************************************"

echo OPERATOR_ID=$OPERATOR_ID >> .env;
echo OPERATOR_KEY=$OPERATOR_KEY >> .env;
echo ADMIN_ID=$ADMIN_ID >> .env;
echo ADMIN_KEY=$ADMIN_KEY >> .env;
echo TREASURE_ID=$TREASURE_ID >> .env;
echo TREASURE_KEY=$TREASURE_KEY >> .env;
echo TOKEN_USER_ID=$TOKEN_USER_ID >> .env;
echo TOKEN_USER_KEY=$TOKEN_USER_KEY >> .env;
echo DEX_CONTRACT_OWNER_ID=$DEX_CONTRACT_OWNER_ID >> .env;
echo DEX_CONTRACT_OWNER_KEY=$DEX_CONTRACT_OWNER_KEY >> .env;
echo UI_USER_ID=$UI_USER_ID >> .env;
echo UI_USER_KEY=$UI_USER_KEY >> .env;

echo "Running contract deployment ........ ";
npx hardhat run ./deployment/checkAndDeploy.ts;

echo "********************  Done *************************************";