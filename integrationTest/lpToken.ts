import { BigNumber } from "bignumber.js";
import {
  AccountId,
  PrivateKey,
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Client,
  ContractId,
  AccountBalanceQuery
} from "@hashgraph/sdk";

const createClient = () => {
  const myAccountId = AccountId.fromString("0.0.47540202");
  const myPrivateKey = PrivateKey.fromString("302e020100300506032b657004220420b69079b0cdebea97ec13c78bf7277d3f4aef35189755b5d11c2dfae40c566aa8");

  if (myAccountId == null || myPrivateKey == null) {
    throw new Error(
      "Environment variables myAccountId and myPrivateKey must be present"
    );
  }

  const client = Client.forTestnet();
  client.setOperator(myAccountId, myPrivateKey);
  return client;
};

const client = createClient();
const tokenA = TokenId.fromString("0.0.47646195").toSolidityAddress();
let tokenB = TokenId.fromString("0.0.47646196").toSolidityAddress();
const treasure = AccountId.fromString("0.0.47645191").toSolidityAddress();
const treasureKey = PrivateKey.fromString("308ed38983d9d20216d00371e174fe2d475dd32ac1450ffe2edfaab782b32fc5");

const contractId = ContractId.fromString("0.0.48101341");//0x0000000000000000000000000000000002ddf018

const itegrationTestLPToken = async () => {
// Contract created 0.0.48101341 ,Contract Address 0000000000000000000000000000000002ddf7dd
//STEP 3 - Create token
//- Token created 0.0.48101342, Token Address 0000000000000000000000000000000002ddf7de
  let aliceAccount = AccountId.fromString("0.0.48099349");
  let tokenId = TokenId.fromString("0.0.48101342");

  if (tokenId != null && contractId != null && aliceAccount != null) {
  let contractFunctionParameters = new ContractFunctionParameters()
      

  console.log(`\n STEP 7 - query token name with a transaction`);

  const contractNameTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("getName")
      .setGas(500000)
      .execute(client);

  const contractNameTxRecord = await contractNameTx.getRecord(client);

  console.log(contractNameTxRecord?.contractFunctionResult?.getString(0));
  
  console.log(`\n STEP 8 - minting 10 to Alice`);
  contractFunctionParameters = new ContractFunctionParameters()
      //.addInt64(new BigNumber(10));
      // .addInt64(new BigNumber(10))
       .addAddress(aliceAccount.toSolidityAddress());

  console.log(`\n STEP 10 - using Service`);
  const tokenAQty = new BigNumber(10);
  const tokenBQty = new BigNumber(10);
  contractFunctionParameters = new ContractFunctionParameters()
      .addUint64(tokenAQty)
      .addUint64(tokenBQty)
      .addAddress(aliceAccount.toSolidityAddress());

  // switch client to alice
  //client.setOperator(aliceAccount, aliceKey);

  const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("allotLPTokenFor", contractFunctionParameters)
      .setGas(900000)
      .execute(client);
  await contractAllotTx.getReceipt(client);

  console.log(`\n STEP 11 - Alice Balance`);

  const aliceBalance1 = await new AccountBalanceQuery()
      .setAccountId(aliceAccount)
      .execute(client);

  console.log(aliceBalance1.tokens);
  }
};

async function main() {
  await itegrationTestLPToken();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
