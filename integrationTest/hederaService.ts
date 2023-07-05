import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import {
  TokenType,
  PrivateKey,
  ContractId,
  TokenInfoQuery,
  TokenSupplyType,
  AccountBalanceQuery,
  ContractFunctionParameters,
  TokenCreateTransaction,
  ContractExecuteTransaction,
} from "@hashgraph/sdk";

const {
  operatorId: userAccountId,
  operatorKey: userPrivateKey,
  proxyAdminClient: client,
} = clientsInfo;

const contractService = new ContractService();
const hederaService = contractService.getContract(
  contractService.hederaServiceContractName
);
const contractIdObject = ContractId.fromString(hederaService.id);

async function main() {
  const { tokenId, tokenAddressSol } = await createToken(100);
  await tokenQueryFunction(tokenId);
  await mintTokenPublic(hederaService.id, tokenAddressSol, 50);
  await burnTokenPublic(hederaService.id, tokenAddressSol, 25);
  await tokenQueryFunction(tokenId);
  await associateTokenPublic(
    hederaService.id,
    userAccountId.toSolidityAddress(),
    userPrivateKey,
    tokenAddressSol
  );
  await transferTokenPublic(
    hederaService.id,
    tokenAddressSol,
    clientsInfo.treasureId.toSolidityAddress(),
    userAccountId.toSolidityAddress(),
    20
  );
  await balanceQueryFunction(userAccountId.toString(), tokenId);
  await balanceQueryFunction(clientsInfo.treasureId.toString(), tokenId);
  return "executed successfully";
}

/**
 *
 * @param initialSupply
 * @returns
 */
async function createToken(initialSupply: number) {
  const tx = await new TokenCreateTransaction()
    .setTokenName("SampleToken")
    .setTokenSymbol("ST")
    .setInitialSupply(initialSupply)
    .setDecimals(0)
    .setTreasuryAccountId(clientsInfo.treasureId)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(contractIdObject)
    .freezeWith(client)
    .sign(clientsInfo.treasureKey);

  const txResponse = await tx.execute(client);
  const txReceipt = await txResponse.getReceipt(client);
  const tokenId = txReceipt.tokenId!;
  const tokenAddressSol = tokenId.toSolidityAddress();
  const item = {
    tokenId: tokenId.toString(),
    tokenAddressSol,
  };
  console.log(`- Token ID: ${item.tokenId}`);
  console.log(`- Token ID in Solidity format: ${item.tokenAddressSol}`);
  return item;
}

/**
 *
 * @param contractId
 * @param tokenAddress
 * @param amount
 * @returns
 */
async function mintTokenPublic(
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
  const record = await txnResponse.getRecord(client);
  const responseCode = record.contractFunctionResult!.getInt256(0).c![0];
  const totalSupply = record.contractFunctionResult!.getInt256(1).c![0];
  console.log(
    `- Token (${amount}) minted: ${JSON.stringify({
      responseCode,
      totalSupply,
    })}`
  );
}

/**
 *
 * @param contractId
 * @param tokenAddress
 * @param amount
 * @returns
 */
async function burnTokenPublic(
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
  console.log(
    `- Token (${amount}) burned: ${JSON.stringify({
      responseCode,
      totalSupply,
    })}`
  );
}

/**
 *
 * @param contractId
 * @param userAccountAddress
 * @param userAccountPrivateKey
 * @param tokenAddress
 * @returns
 */
async function associateTokenPublic(
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
  console.log(
    `- Token assosiation (reponse-code => 22 means success : ${responseCode}`
  );
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
async function transferTokenPublic(
  contractId: string,
  tokenAddress: string,
  senderAddress: string,
  receiverAddress: string,
  amount: number
) {
  const args = new ContractFunctionParameters()
    .addAddress(tokenAddress)
    .addAddress(senderAddress)
    .addAddress(receiverAddress)
    .addInt256(new BigNumber(amount));
  const txn = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction("transferTokenPublic", args);
  const txnResponse = await txn.execute(client);
  const txnRecord = await txnResponse.getRecord(client);
  const responseCode = txnRecord.contractFunctionResult!.getInt256(0).c![0];
  console.log(
    `- Token (${amount}) transfer (reponse-code => 22 means success) : ${responseCode}`
  );
}

/**
 *
 * @param tokenId
 * @returns
 */
async function tokenQueryFunction(tokenId: string) {
  const response = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
  console.log(`- Token count: ${response.totalSupply.low}`);
}

/**
 *
 * @param accountId
 * @param tokenId
 * @returns
 */
async function balanceQueryFunction(accountId: string, tokenId: string) {
  const balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(accountId)
    .execute(client);
  const userTokenBalance = balanceCheckTx.tokens!._map.get(tokenId.toString());
  console.log(`- Token balance  : ${userTokenBalance}`);
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
