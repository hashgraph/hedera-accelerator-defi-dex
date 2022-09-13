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
const treasureAccountId = AccountId.fromString("0.0.47645191");
const treasureKey = PrivateKey.fromString("308ed38983d9d20216d00371e174fe2d475dd32ac1450ffe2edfaab782b32fc5");

const contractId = ContractId.fromString("0.0.48190509"); //6 Sep 04:45

const integrationTestLPToken = async () => {

  let aliceAccount2 = AccountId.fromString("0.0.48133780");

  if (contractId != null && aliceAccount2 != null) {
  let contractFunctionParameters = new ContractFunctionParameters()
  
  console.log(`\n STEP 10 - using Service`);
  const tokenAQty = new BigNumber(10);
  const tokenBQty = new BigNumber(10);
  contractFunctionParameters = new ContractFunctionParameters()
      .addUint64(tokenAQty)
      .addUint64(tokenBQty)
      .addAddress(aliceAccount2.toSolidityAddress());

  const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("allotLPTokenFor", contractFunctionParameters)
      .setGas(900000)
      .execute(client);
  const contractAllotRx = await contractAllotTx.getReceipt(client);
  const response = await contractAllotTx.getRecord(client);
  const status = contractAllotRx.status;
  console.log(`\n allotLPTokenFor Result ${status} code: ${response.contractFunctionResult!.getInt64()}`);

  console.log(`\n STEP 11 - Alice Balance`);

  const aliceBalance1 = await new AccountBalanceQuery()
      .setAccountId(aliceAccount2)
      .execute(client);

  console.log(aliceBalance1.tokens);
  }
};

async function main() {
  await integrationTestLPToken();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
