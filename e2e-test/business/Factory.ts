import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  Hbar,
  PrivateKey,
  Client,
  AccountId,
  AccountBalanceQuery,
} from "@hashgraph/sdk";
import { Helper } from "../../utils/Helper";

export default class Factory {
  public withPrecision = (value: number, precision: number): BigNumber => {
    return new BigNumber(value).multipliedBy(precision);
  };

  public setupFactory = async (
    baseContractAddress: string,
    contractId: string,
    client: Client
  ) => {
    console.log(`\nSetupFactory`);
    const adminId = AccountId.fromString(process.env.ADMIN_ID!);
    let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(baseContractAddress)
      .addAddress(adminId.toSolidityAddress());
    const contractTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("setUpFactory", contractFunctionParameters)
      .setGas(9000000)
      .execute(client);
    const receipt = await contractTx.getReceipt(client);
    const response = await contractTx.getRecord(client);
    const status = receipt.status;
    console.log(
      `\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`
    );
  };

  public createPair = async (
    contractId: string,
    token0: TokenId,
    token1: TokenId,
    treasureId: AccountId,
    treasureKey: PrivateKey,
    client: Client
  ) => {
    const createPairTx = await new ContractExecuteTransaction()
      .setContractId(contractId)

      .setGas(9999000)

      .setFunction(
        "createPair",
        new ContractFunctionParameters()
          .addAddress(token0.toSolidityAddress())
          .addAddress(token1.toSolidityAddress())
          .addAddress(treasureId.toSolidityAddress())
          .addInt256(new BigNumber(10))
      )
      .setMaxTransactionFee(new Hbar(100))
      .setPayableAmount(new Hbar(100))
      .freezeWith(client)
      .sign(treasureKey);

    const createPairTxRes = await createPairTx.execute(client);
    const receipt = await createPairTxRes.getReceipt(client);
    const record = await createPairTxRes.getRecord(client);
    const contractAddress = record.contractFunctionResult!.getAddress(0);
    console.log(`CreatePair address: ${contractAddress}`);
    console.log(`CreatePair status: ${receipt.status}`);
    return contractAddress;
  };

  public getPair = async (
    contractId: string,
    token0: TokenId,
    token1: TokenId,
    client: Client
  ): Promise<string> => {
    console.log(`get Pair`);
    const getPairTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(9999999)
      .setFunction(
        "getPair",
        new ContractFunctionParameters()
          .addAddress(token0.toSolidityAddress())
          .addAddress(token1.toSolidityAddress())
      )
      .freezeWith(client);
    const executedTx = await getPairTx.execute(client);
    const response = await executedTx.getRecord(client);
    console.log(`getPair: ${response.contractFunctionResult!.getAddress(0)}`);
    const receiptRx = await executedTx.getReceipt(client);
    console.log(`getPair: ${receiptRx.status}`);
    return response.contractFunctionResult!.getAddress(0);
  };

  public getAllPairs = async (
    contractId: string,
    client: Client
  ): Promise<string[]> => {
    console.log(`getting AllPairs`);
    const getAllPairsTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(9999999)
      .setFunction("getPairs")
      .freezeWith(client);

    const executedTx = await getAllPairsTx.execute(client);
    const response = await executedTx.getRecord(client);

    console.log(
      `getPairs Count: ${response.contractFunctionResult!.getUint256(1)}`
    );
    const modifiedArray = Helper.getAddressArray(
      response.contractFunctionResult!
    );
    console.log(`get all pair Address: ${modifiedArray}`);

    const receipt = await executedTx.getReceipt(client);
    console.log(`getPairs: ${receipt.status}`);
    return modifiedArray;
  };

  public getTokenPairAddress = async (
    contId: string,
    client: Client,
    treasureKey: PrivateKey
  ): Promise<string> => {
    const getTokensTxReq = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(2000000)
      .setFunction("getTokenPairAddress")
      .freezeWith(client)
      .sign(treasureKey);
    const getTokensTx = await getTokensTxReq.execute(client);
    const record = await getTokensTx.getRecord(client);
    const firstTokenAddress = record.contractFunctionResult!.getAddress(0);
    const secondTokenAddress = record.contractFunctionResult!.getAddress(1);
    const lpTokenAddress = record.contractFunctionResult!.getAddress(2);
    return lpTokenAddress;
  };

  public getTokenBalance = async (
    tokenId: TokenId,
    accountId: AccountId,
    client: Client
  ): Promise<Long> => {
    const treasureBalanceTx = await new AccountBalanceQuery()
      .setAccountId(accountId)
      .execute(client);
    const responseTokens = treasureBalanceTx.tokens ?? new Map<TokenId, Long>();

    console.log(` Treasure Token Balance for : ${responseTokens.get(tokenId)}`);

    return responseTokens.get(tokenId)!;
  };
}
