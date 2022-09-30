
import { Deployment } from "./deployContractOnTestnet";
import {TokenCreateTransaction, FileCreateTransaction, FileAppendTransaction, AccountId, PrivateKey,
  ContractCreateTransaction, TokenType, TokenSupplyType, Hbar, Client, ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    await deployBaseContract()
}

async function deployBaseContract() {
  let client = Client.forTestnet();
  const operatorKey = PrivateKey.fromString("302e020100300506032b657004220420b69079b0cdebea97ec13c78bf7277d3f4aef35189755b5d11c2dfae40c566aa8");

  client.setOperator(
      AccountId.fromString("0.0.47540202"),
      operatorKey
  );
  client.setDefaultMaxTransactionFee(new Hbar(50));

  console.log(`\nSTEP 1 - Create file BaseContract`);
  const rawdata: any = fs.readFileSync("./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json");
  const momContract = JSON.parse(rawdata);
  const contractByteCode = momContract.bytecode;

  //Create a file on Hedera and store the hex-encoded bytecode
  const fileCreateTx = await new FileCreateTransaction().setKeys([operatorKey]).execute(client);
  const fileCreateRx = await fileCreateTx.getReceipt(client);
  const bytecodeFileId = fileCreateRx.fileId;
  console.log(`- The smart contract bytecode file ID BaseContract is: ${bytecodeFileId}`);

  // Append contents to the file
  const fileAppendTx = await new FileAppendTransaction()
      .setFileId(bytecodeFileId ?? "")
      .setContents(contractByteCode)
      .setMaxChunks(20)
      .execute(client);
  await fileAppendTx.getReceipt(client);
  console.log(`- Content added`);

  console.log(`\nSTEP 2 - Create contract BaseContract`);
  const contractCreateTx = await new ContractCreateTransaction()
      .setAdminKey(operatorKey)
      .setBytecodeFileId(bytecodeFileId ?? "")
      .setGas(2000000)
      .execute(client);

  const contractCreateRx = await contractCreateTx.getReceipt(client);
  const contractId = contractCreateRx.contractId;
  console.log(`- Contract created ${contractId?.toString()} ,Contract Address ${contractId?.toSolidityAddress()} -`);
  
  client.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });