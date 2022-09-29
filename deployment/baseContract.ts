
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
  if  (contractId != null) {
      console.log(`\nSTEP 3 - Create token AB`);
      const tokenCreateTx = await new TokenCreateTransaction()
          .setTokenName("hhLP-L49A-L49B")
          .setTokenSymbol("LabA-LabB")
          .setDecimals(0)
          .setInitialSupply(0)
          .setTokenType(TokenType.FungibleCommon)
          .setSupplyType(TokenSupplyType.Infinite)
        //create the token with the contract as supply and treasury
          .setSupplyKey(contractId)
          .setTreasuryAccountId(contractId?.toString() ?? "")
          .execute(client);

    const tokenCreateRx = await tokenCreateTx.getReceipt(client);
    const tokenId = tokenCreateRx.tokenId;
    console.log(`- Token created hhLP-L49A-L49B ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);

    // create LP for TokenC and TokenD

    console.log(`\nSTEP 4 - Create token CD`);
      const tokenCreateCDTx = await new TokenCreateTransaction()
          .setTokenName("hhLP-L49C-L49D")
          .setTokenSymbol("LabC-LabD")
          .setDecimals(0)
          .setInitialSupply(0)
          .setTokenType(TokenType.FungibleCommon)
          .setSupplyType(TokenSupplyType.Infinite)
        //create the token with the contract as supply and treasury
          .setSupplyKey(contractId)
          .setTreasuryAccountId(contractId?.toString() ?? "")
          .execute(client);

    const tokenCreateCDRx = await tokenCreateCDTx.getReceipt(client);
    const tokenCDId = tokenCreateCDRx.tokenId;
    console.log(`- Token created hhLP-L49C-L49D ${tokenCDId}, Token Address ${tokenCDId?.toSolidityAddress()}`);

    // create LP for TokenC and TokenD

    console.log(`\nSTEP 5 - Create token EF`);
      const tokenCreateEFTx = await new TokenCreateTransaction()
          .setTokenName("hhLP-L49E-L49F")
          .setTokenSymbol("LabE-LabF")
          .setDecimals(0)
          .setInitialSupply(0)
          .setTokenType(TokenType.FungibleCommon)
          .setSupplyType(TokenSupplyType.Infinite)
        //create the token with the contract as supply and treasury
          .setSupplyKey(contractId)
          .setTreasuryAccountId(contractId?.toString() ?? "")
          .execute(client);

    const tokenCreateEFRx = await tokenCreateEFTx.getReceipt(client);
    const tokenEFId = tokenCreateEFRx.tokenId;
    console.log(`- Token created hhLP-L49E-L49F ${tokenEFId}, Token Address ${tokenEFId?.toSolidityAddress()}`);

}
  client.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });