/* eslint-disable no-process-exit */
/* eslint-disable node/no-unpublished-import */
/* eslint-disable node/no-missing-import */

import {
  ContractFunctionParameters,
  ContractId,
  AccountBalanceQuery,
  TokenCreateTransaction,
  PrivateKey,
  TokenInfoQuery,
  ContractExecuteTransaction,
  Hbar,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";

import { BigNumber } from "../node_modules/bignumber.js";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const cm = new ClientManagement();
// user who is going to get the token
const { id: userAccountId, key: userPrivateKey } = cm.getOperator();
// client details
// executing all txn with below client
const client = cm
  .createClientAsAdmin()
  .setDefaultMaxTransactionFee(new Hbar(50));
const clientDetails = cm.getAdmin();

const contractService = new ContractService();
const baseHts = contractService.getContract(contractService.baseContractName);
const contractIdObject = ContractId.fromString(baseHts.id);

class BaseHTS {
  async execute() {
    // contracts details
    console.log(`- The smart contract details are: ${JSON.stringify(baseHts)}`);

    // creating token
    const { tokenId, tokenAddressSol } = await this.createToken(100);
    console.log(`- Token ID: ${tokenId}`);
    console.log(`- Token ID in Solidity format: ${tokenAddressSol}`);

    // token supply query
    const tokenResponse1 = await this.tokenQueryFunction(tokenId);
    console.log(`- Token initial count: ${tokenResponse1.totalSupply.low}`);

    // mint tokens
    const mintCount = 50;
    const mintTokenResponse = await this.mintTokenPublic(
      baseHts.id,
      tokenAddressSol,
      mintCount
    );
    console.log(
      `- Token (${mintCount}) minted: ${JSON.stringify(mintTokenResponse)}`
    );

    // burn 25 tokens
    const burnCount = 25;
    const burnTokenResponse = await this.burnTokenPublic(
      baseHts.id,
      tokenAddressSol,
      burnCount
    );
    console.log(
      `- Token (${burnCount}) burned: ${JSON.stringify(burnTokenResponse)}`
    );

    // token supply query
    const tokenResponse3 = await this.tokenQueryFunction(tokenId);
    console.log(
      `- Token count after modification: ${tokenResponse3.totalSupply.low}`
    );

    // assosiate token
    const assosiateResponseCode = await this.associateTokenPublic(
      baseHts.id,
      userAccountId.toSolidityAddress(),
      userPrivateKey,
      tokenAddressSol
    );
    console.log(
      `- Token assosiation (reponse-code => 22 means success : ${assosiateResponseCode}`
    );

    // transfer 20 token
    const transferCount = 20;
    const transferResponseCode = await this.transferTokenPublic(
      baseHts.id,
      tokenAddressSol,
      clientDetails.adminId.toSolidityAddress(),
      userAccountId.toSolidityAddress(),
      transferCount
    );
    console.log(
      `- Token (${transferCount}) transfer (reponse-code => 22 means success) : ${transferResponseCode}`
    );

    const userTokenBalance = await this.balanceQueryFunction(
      userAccountId.toString(),
      tokenId
    );
    console.log(`- Token balance of user account : ${userTokenBalance}`);

    const mainAccountBalance = await this.balanceQueryFunction(
      clientDetails.adminId.toString(),
      tokenId
    );
    console.log(`- Token balance of main account : ${mainAccountBalance}`);

    return "executed successfully";
  }

  /**
   *
   * @param initialSupply
   * @returns
   */
  private async createToken(initialSupply: number) {
    const tx = await new TokenCreateTransaction()
      .setTokenName("SampleToken")
      .setTokenSymbol("ST")
      .setInitialSupply(initialSupply)
      .setDecimals(0)
      .setTreasuryAccountId(clientDetails.adminId)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(contractIdObject) // passing contract id as suppy key
      .freezeWith(client)
      .sign(clientDetails.adminKey);

    const txResponse = await tx.execute(client);
    const txReceipt = await txResponse.getReceipt(client);
    const tokenId = txReceipt.tokenId!;
    const tokenAddressSol = tokenId.toSolidityAddress();
    return { tokenId: tokenId.toString(), tokenAddressSol };
  }

  /**
   *
   * @param contractId
   * @param tokenAddress
   * @param amount
   * @returns
   */
  private async mintTokenPublic(
    contractId: string,
    tokenAddress: string,
    amount: number
  ) {
    const args = new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addInt256(new BigNumber(amount));
    const txn = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(3000000)
      .setFunction("mintTokenPublic", args);
    const txnResponse = await txn.execute(client);
    const createTokenRx = await txnResponse.getRecord(client);
    const responseCode =
      createTokenRx.contractFunctionResult!.getInt256(0).c![0];
    const totalSupply =
      createTokenRx.contractFunctionResult!.getInt256(1).c![0];
    return { responseCode, totalSupply };
  }

  /**
   *
   * @param contractId
   * @param tokenAddress
   * @param amount
   * @returns
   */
  private async burnTokenPublic(
    contractId: string,
    tokenAddress: string,
    amount: number
  ) {
    const args = new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addInt256(new BigNumber(amount));
    const txn = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(3000000)
      .setFunction("burnTokenPublic", args);
    const txnResponse = await txn.execute(client);
    const txnRecord = await txnResponse.getRecord(client);
    const responseCode = txnRecord.contractFunctionResult!.getInt256(0).c![0];
    const totalSupply = txnRecord.contractFunctionResult!.getInt256(1).c![0];
    return { responseCode, totalSupply };
  }

  /**
   *
   * @param contractId
   * @param userAccountAddress
   * @param userAccountPrivateKey
   * @param tokenAddress
   * @returns
   */
  private async associateTokenPublic(
    contractId: string,
    userAccountAddress: string,
    userAccountPrivateKey: PrivateKey,
    tokenAddress: string
  ) {
    const args = new ContractFunctionParameters()
      .addAddress(userAccountAddress)
      .addAddress(tokenAddress);
    const txn = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(3000000)
      .setFunction("associateTokenPublic", args)
      .freezeWith(client)
      .sign(userAccountPrivateKey);
    const txnResponse = await txn.execute(client);
    const txnRecord = await txnResponse.getRecord(client);
    const responseCode = txnRecord.contractFunctionResult!.getInt256(0).c![0];
    return responseCode;
  }

  /**
   *
   * @param contractId
   * @param tokenAddress
   * @param senderAddress
   * @param receicerAddress
   * @param amount
   * @returns
   */
  private async transferTokenPublic(
    contractId: string,
    tokenAddress: string,
    senderAddress: string,
    receicerAddress: string,
    amount: number
  ) {
    const args = new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addAddress(senderAddress)
      .addAddress(receicerAddress)
      .addInt256(new BigNumber(amount));
    const txn = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(3000000)
      .setFunction("transferTokenPublic", args);
    const txnResponse = await txn.execute(client);
    const txnRecord = await txnResponse.getRecord(client);
    const responseCode = txnRecord.contractFunctionResult!.getInt256(0).c![0];
    return responseCode;
  }

  /**
   *
   * @param tokenId
   * @returns
   */
  private async tokenQueryFunction(tokenId: string) {
    return await new TokenInfoQuery().setTokenId(tokenId).execute(client);
  }

  /**
   *
   * @param accountId
   * @param tokenId
   * @returns
   */
  private async balanceQueryFunction(accountId: string, tokenId: string) {
    const balanceCheckTx = await new AccountBalanceQuery()
      .setAccountId(accountId)
      .execute(client);
    return balanceCheckTx.tokens!._map.get(tokenId.toString());
  }
}

new BaseHTS()
  .execute()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
