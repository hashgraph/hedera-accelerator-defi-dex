import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  AccountId,
  PrivateKey
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
const client = clientManagement.createClient();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;
const {treasureId, treasureKey} = clientManagement.getTreasure();
const {adminId, adminKey} = clientManagement.getAdmin();
const adminClient = clientManagement.createClientAsAdmin();

const baseContract = contractService.getContract(contractService.baseContractName);
const lpContracts = contractService.getLast3Contracts(contractService.lpTokenContractName); //"0.0.48461951"

const createToken =  async (tokenName: string, symbol: string): Promise<TokenId> => {
  console.log(`Using base contract id ${baseContract.id} `);

  const createTokenTx = await new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(symbol)
    .setDecimals(8)
    .setInitialSupply(0)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    //create the token with the contract as supply and treasury
    .setSupplyKey(ContractId.fromString(baseContract.id))
    .setTreasuryAccountId(baseContract.id)
    .execute(adminClient);

    const tokenCreateTx = await createTokenTx.getReceipt(adminClient);
    const tokenId = tokenCreateTx.tokenId;
    console.log(`Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);
    return tokenId!;
}

const initialize = async (tokenId: TokenId, contractId: string) => {
  console.log(`Initialize contract with token ${tokenId.toString()} `);

    let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(tokenId.toSolidityAddress())
      .addAddress(htsServiceAddress);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId ?? "")
      .setFunction("initializeParams", contractFunctionParameters)
      .setGas(500000)
      .execute(client);
      
    await contractTokenTx.getReceipt(client);

  console.log(`Initialize contract with token ${tokenId.toString()} done.`);
}

const allotLPTokenFor = async (contractId: string) => {
    const tokenAQty = new BigNumber(10);
    const tokenBQty = new BigNumber(10);

    console.log(`allotLPTokenFor tokenAQty ${tokenAQty} tokenBQty ${tokenBQty}`);
  
    const contractFunctionParameters = new ContractFunctionParameters()
        .addInt256(tokenAQty)
        .addInt256(tokenBQty)
        .addAddress(treasureId.toSolidityAddress());

    const contractAllotTx = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setFunction("allotLPTokenFor", contractFunctionParameters)
        .setGas(900000)
        .execute(client);

    const contractAllotRx = await contractAllotTx.getReceipt(client);
    const response = await contractAllotTx.getRecord(client);
    const status = contractAllotRx.status;
    console.log(`allotLPTokenFor result ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

const removeLPTokenFor = async (contractId: string) => {
  const lpTokenQty = new BigNumber(5);

  console.log(`removeLPTokenFor ${lpTokenQty}`);

  const contractFunctionParameters = new ContractFunctionParameters()
      .addInt256(lpTokenQty)
      .addAddress(treasureId.toSolidityAddress());

  const contractRemoveTx0 = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("removeLPTokenFor", contractFunctionParameters)
      .setGas(3000000)
      .freezeWith(client)
      .sign(treasureKey);

  const contractRemoveTx = await contractRemoveTx0.execute(client);
  const contractRemoveRx = await contractRemoveTx.getReceipt(client);
  const response = await contractRemoveTx.getRecord(client);
  const status = contractRemoveRx.status;
  console.log(`Remove LP Token ${status} code: ${response.contractFunctionResult!.getInt64()}`);
}

const getBalance = async(tokenId: TokenId) => {
  const balance = await new AccountBalanceQuery()
  .setAccountId(treasureId)
  .execute(client);

  console.log(balance.tokens?.get(tokenId.toString()));
}

async function main() {
  
    await forSingleContract(lpContracts[0].id, "hhLP-L49A-L49B", "LabA-LabB")
    await forSingleContract(lpContracts[1].id, "hhLP-L49C-L49D", "LabC-LabD")
    await forSingleContract(lpContracts[2].id, "hhLP-L49E-L49F", "LabE-LabF")
}

async function forSingleContract(contractId: string, tokenName:string, tokenSymbol: string) {
  const tokenId = await createToken(tokenName, tokenSymbol);
  await initialize(tokenId, contractId);
  await allotLPTokenFor(contractId);
  await removeLPTokenFor(contractId);
  await getBalance(tokenId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
