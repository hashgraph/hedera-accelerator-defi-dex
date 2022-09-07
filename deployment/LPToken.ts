
import { Deployment } from "./deployContractOnTestnet";

import {TokenCreateTransaction, FileCreateTransaction, FileAppendTransaction, AccountId, PrivateKey,
  ContractCreateTransaction, TokenType, TokenSupplyType, Hbar, Client, ContractId, AccountCreateTransaction, KeyList,
  ContractUpdateTransaction, ContractInfoQuery, ContractExecuteTransaction,
  ContractFunctionParameters, TokenUpdateTransaction, TokenInfoQuery, TokenAssociateTransaction, AccountBalanceQuery, TokenId
} from "@hashgraph/sdk";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: '../../.env' });

async function main() {
   await deployTokenContract();
}

async function createAccount(client: Client) {
  // console.log(`\nSTEP 0 - Create accounts`);
    const aliceKey = PrivateKey.generateED25519();

    let createAccountTx = await new AccountCreateTransaction()
        .setKey(aliceKey.publicKey)
        .setMaxAutomaticTokenAssociations(20)
        .setInitialBalance(1)
        .execute(client);

    let createAccountRx = await createAccountTx.getReceipt(client);
    const aliceAccount = createAccountRx.accountId;
    console.log(`- Alice account is ${aliceAccount?.toString()} \n privatekey: ${aliceKey}`);
}

async function deployTokenContract() {
    let client = Client.forTestnet();
    const htsServiceAddress = "0x0000000000000000000000000000000002df4f79"; // 6 sep 2:41
    const operatorKey = PrivateKey.fromString("302e020100300506032b657004220420b69079b0cdebea97ec13c78bf7277d3f4aef35189755b5d11c2dfae40c566aa8");

    client.setOperator(
        AccountId.fromString("0.0.47540202"),
        operatorKey
    );
    client.setDefaultMaxTransactionFee(new Hbar(50));

    console.log(`\nSTEP 1 - Create file`);
    const rawdata: any = fs.readFileSync("./artifacts/contracts/LPToken.sol/LPToken.json");
    //console.log(`Raw data ${rawdata}`);
    const momContract = JSON.parse(rawdata);
    const contractByteCode = momContract.bytecode;

    //Create a file on Hedera and store the hex-encoded bytecode
    const fileCreateTx = await new FileCreateTransaction().setKeys([operatorKey]).execute(client);
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
        .setAdminKey(operatorKey)
        .setBytecodeFileId(bytecodeFileId ?? "")
        .setGas(2000000)
        .execute(client);

    const contractCreateRx = await contractCreateTx.getReceipt(client);
    const contractId = contractCreateRx.contractId;
    console.log(`- Contract created ${contractId?.toString()} ,Contract Address ${contractId?.toSolidityAddress()} -`);
    if  (contractId != null) {
    //     console.log(`\nSTEP 3 - Create token`);
    //     const tokenCreateTx = await new TokenCreateTransaction()
    //         .setTokenName("TOKENA-TOKENB")
    //         .setTokenSymbol("A-B")
    //         .setDecimals(0)
    //         .setInitialSupply(0)
    //         .setTokenType(TokenType.FungibleCommon)
    //         .setSupplyType(TokenSupplyType.Infinite)
    //       //create the token with the contract as supply and treasury
    //         .setSupplyKey(contractId)
    //         .setTreasuryAccountId(contractId?.toString() ?? "")
    //         .execute(client);

    //   const tokenCreateRx = await tokenCreateTx.getReceipt(client);
       const tokenId = TokenId.fromString("0.0.48189306"); // 6 sep 2:45
    //   console.log(`- Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);

      console.log(`\n STEP 6 - call the contract to set the token id`);


      if (tokenId != null && contractId != null) {
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