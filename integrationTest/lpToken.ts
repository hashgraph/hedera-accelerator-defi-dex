import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountBalanceQuery
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";

const clientManagement = new ClientManagement();
const client = clientManagement.createClientAsAdmin();

const {treasureId, treasureKey} = clientManagement.getTreasure();

const contractId = ContractId.fromString("0.0.48283002"); //19 Sep 15:10

const integrationTestLPToken = async () => {
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


  console.log(`\n STEP 3 - Treasure Balance`);

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
