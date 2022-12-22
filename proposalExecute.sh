#!/bin/sh

# Keep node alive
set -e
echo "********************  Env variables *********************"

OPERATOR_ID=$1;
OPERATOR_KEY=$2;
ADMIN_ID=$3;
ADMIN_KEY=$4;
TREASURE_ID=$5;
TREASURE_KEY=$6;
TOKEN_USER_ID=$7;
TOKEN_USER_KEY=$8;
DEX_CONTRACT_OWNER_ID=$9;
DEX_CONTRACT_OWNER_KEY=${10};
PROPOSAL_CONTRACT_ID=${11};

echo PROPOSAL_CONTRACT_ID $PROPOSAL_CONTRACT_ID

echo "********************  Execution *************************************"

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
echo PROPOSAL_CONTRACT_ID=$PROPOSAL_CONTRACT_ID >> .env;

echo "********************  Done *************************************";