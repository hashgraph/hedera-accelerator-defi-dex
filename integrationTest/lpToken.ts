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
import ClientManagement from "./utils/utils";

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

const clientManagement = new ClientManagement();
const client = clientManagement.createClientAsAdmin();

const tokenA = TokenId.fromString("0.0.47646195").toSolidityAddress();
let tokenB = TokenId.fromString("0.0.47646196").toSolidityAddress();
const {treasureId, treasureKey} = clientManagement.getTreasure();

const contractId = ContractId.fromString("0.0.48281590"); //19 Sep 15:10

const integrationTestLPToken = async () => {

  //let aliceAccount2 = AccountId.fromString("0.0.48133780");

  if (contractId != null && treasureId != null) {
  let contractFunctionParameters = new ContractFunctionParameters()
  
  console.log(`\n STEP 1 - using Service`);
  const tokenAQty = new BigNumber(10);
  const tokenBQty = new BigNumber(10);
  const lpTokenQty = new BigNumber(5);
  contractFunctionParameters = new ContractFunctionParameters()
      .addUint64(tokenAQty)
      .addUint64(tokenBQty)
      .addAddress(treasureId.toSolidityAddress());

  const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("allotLPTokenFor", contractFunctionParameters)
      .setGas(900000)
      .execute(client);
  const contractAllotRx = await contractAllotTx.getReceipt(client);
  const response = await contractAllotTx.getRecord(client);
  const status = contractAllotRx.status;
  console.log(`\n allotLPTokenFor Result ${status} code: ${response.contractFunctionResult!.getInt64()}`);

  contractFunctionParameters = new ContractFunctionParameters()
      .addInt64(lpTokenQty)
      .addAddress(treasureId.toSolidityAddress());
  console.log(`\n STEP 2 Remove LP Token`);
  const contractRemoveTx0 = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("removeLPTokenFor", contractFunctionParameters)
      .setGas(2000000)
      .freezeWith(client)
      .sign(treasureKey);

  const contractRemoveTx = await contractRemoveTx0.execute(client);
  const contractRemoveRx = await contractRemoveTx.getReceipt(client);
  const response1 = await contractRemoveTx.getRecord(client);
  const status1 = contractRemoveRx.status;
  console.log(`\n Remove LP Token ${status1} code: ${response1.contractFunctionResult!.getInt64()}`);

  console.log(`\n STEP 3 - Alice Balance`);

  const aliceBalance1 = await new AccountBalanceQuery()
      .setAccountId(treasureId)
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
