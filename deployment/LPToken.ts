
import { Deployment } from "./deployContractOnTestnet";

import {TokenCreateTransaction, FileCreateTransaction, FileAppendTransaction, AccountId, PrivateKey,
  ContractCreateTransaction, TokenType, TokenSupplyType, Hbar, Client, ContractId, AccountCreateTransaction, KeyList,
  ContractUpdateTransaction, ContractInfoQuery, ContractExecuteTransaction,
  ContractFunctionParameters, TokenUpdateTransaction, TokenInfoQuery, TokenAssociateTransaction, AccountBalanceQuery
} from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import dotenv from "dotenv";
import * as hethers from "@hashgraph/hethers";

dotenv.config({ path: '../../.env' });

//const momContract = require("./artifacts/contracts/LPToken.sol/LPToken.json");

const contractId = "0.0.47814722";

async function main() {
   await deployTokenContract();
   //const htsServiceAddress = "0x0000000000000000000000000000000002dca55f"; //contract id 0.0.47818234
    //  const lpTokenAddress = "0000000000000000000000000000000002dc31b7" // tokenID: 0.0.47985079
    //  const deployment0 = new Deployment();
    // const filePath0 = "./artifacts/contracts/LPToken.sol/LPToken.json";
    // const deployedContract0 = await deployment0.deployContract(filePath0, [htsServiceAddress]);
    // console.log("LPToken deployed.");
}

async function deployTokenContract() {
  let client = Client.forTestnet();
    const htsServiceAddress = "0x0000000000000000000000000000000002ddf7a2";
    const operatorKey = PrivateKey.fromString("302e020100300506032b657004220420b69079b0cdebea97ec13c78bf7277d3f4aef35189755b5d11c2dfae40c566aa8");

    client.setOperator(
        AccountId.fromString("0.0.47540202"),
        operatorKey
    );

    console.log(`\nSTEP 0 - Create accounts`);
    const adminKey = PrivateKey.generateED25519();
    const aliceKey = PrivateKey.generateED25519();

    let createAccountTx = await new AccountCreateTransaction()
        .setKey(adminKey.publicKey)
        .setInitialBalance(1)
        .execute(client);

    let createAccountRx = await createAccountTx.getReceipt(client);
    const adminAccount = createAccountRx.accountId;
    console.log(`- Admin account is ${adminAccount?.toString()}`);

    createAccountTx = await new AccountCreateTransaction()
        .setKey(aliceKey.publicKey)
        .setMaxAutomaticTokenAssociations(20)
        .setInitialBalance(1)
        .execute(client);

    createAccountRx = await createAccountTx.getReceipt(client);
    const aliceAccount = createAccountRx.accountId;
    console.log(`- Alice account is ${aliceAccount?.toString()} \n privatekey: ${aliceKey}`);

    // switch client to admin
    client.setOperator(adminAccount ?? "", adminKey);
    client.setDefaultMaxTransactionFee(new Hbar(50));

    console.log(`\nSTEP 1 - Create file`);
    const rawdata: any = fs.readFileSync("./artifacts/contracts/LPToken.sol/LPToken.json");
    //console.log(`Raw data ${rawdata}`);
    const momContract = JSON.parse(rawdata);
    const contractByteCode = momContract.bytecode;

    //Create a file on Hedera and store the hex-encoded bytecode
    const fileCreateTx = await new FileCreateTransaction().setKeys([adminKey]).execute(client);
    const fileCreateRx = await fileCreateTx.getReceipt(client);
    const bytecodeFileId = fileCreateRx.fileId;
    console.log(`- The smart contract bytecode file ID is: ${bytecodeFileId}`);

    // Append contents to the file
    const fileAppendTx = await new FileAppendTransaction()
        .setFileId(bytecodeFileId ?? "")
        .setContents(contractByteCode)
        .setMaxChunks(20)
        .execute(client);
    await fileAppendTx.getReceipt(client);
    console.log(`- Content added`);

    console.log(`\nSTEP 2 - Create contract`);
    const contractCreateTx = await new ContractCreateTransaction()
        .setAdminKey(adminKey)
        .setBytecodeFileId(bytecodeFileId ?? "")
        .setGas(2000000)
        .execute(client);

    const contractCreateRx = await contractCreateTx.getReceipt(client);
    const contractId = contractCreateRx.contractId;
    console.log(`- Contract created ${contractId?.toString()} ,Contract Address ${contractId?.toSolidityAddress()} -`);
    if  (contractId != null) {
        console.log(`\nSTEP 3 - Create token`);
        const tokenCreateTx = await new TokenCreateTransaction()
            .setTokenName("TOKENA-TOKENB")
            .setTokenSymbol("A-B")
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
      console.log(`- Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);
      console.log(`\n STEP 6 - call the contract to set the token id`);


      if (tokenId != null && contractId != null && aliceAccount != null) {
      let contractFunctionParameters = new ContractFunctionParameters()
        .addAddress(tokenId.toSolidityAddress())
        .addAddress(htsServiceAddress);

      const contractTokenTx = await new ContractExecuteTransaction()
        .setContractId(contractId ?? "")
        .setFunction("initializeParams", contractFunctionParameters)
        .setGas(500000)
        .execute(client);
      await contractTokenTx.getReceipt(client);
    }
  }
    client.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });