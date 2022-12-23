import { BigNumber } from "bignumber.js";
import {
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
  PrivateKey,
  Client,
  AccountId,
} from "@hashgraph/sdk";

export default class Pair {
  public createToken = async (
    tokenName: string,
    treasureKey: PrivateKey,
    treasureId: AccountId,
    treasurerClient: Client,
    client: Client
  ): Promise<TokenId> => {
    const createTokenTx = await new TokenCreateTransaction()
      .setTokenName("Token" + tokenName)
      .setTokenSymbol("Token Symbol" + tokenName)
      .setDecimals(8)
      .setInitialSupply(20000000000000)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(treasureKey)
      .setTreasuryAccountId(treasureId)
      .execute(treasurerClient);

    const tokenCreateTx = await createTokenTx.getReceipt(client);
    const tokenId = tokenCreateTx.tokenId;
    console.log(
      `Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`
    );
    return tokenId!;
  };

  public initializeLPTokenContract = async (
    lpTokenContractId: string,
    client: Client,
    htsServiceAddress: string
  ) => {
    console.log(`Initialize LP contract with lp contract ${lpTokenContractId}`);
    let contractFunctionParameters =
      new ContractFunctionParameters().addAddress(htsServiceAddress);
    const initializeContractTx = await new ContractExecuteTransaction()
      .setContractId(lpTokenContractId)
      .setFunction("initialize", contractFunctionParameters)
      .setGas(500000)
      .setMaxTransactionFee(new Hbar(50))
      .setPayableAmount(new Hbar(60))
      .execute(client);

    await initializeContractTx.getReceipt(client);

    console.log(`Initialize LP contract with token done.`);
  };
  public initializePairContract = async (
    contId: string,
    lpTokenProxyAdd: string,
    htsServiceAddress: string,
    tokenA: TokenId,
    tokenB: TokenId,
    treasureId: AccountId,
    client: Client,
    key: PrivateKey
  ) => {
    const initialize = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(9000000)
      .setFunction(
        "initialize",
        new ContractFunctionParameters()
          .addAddress(htsServiceAddress)
          .addAddress(lpTokenProxyAdd)
          .addAddress(tokenA.toSolidityAddress())
          .addAddress(tokenB.toSolidityAddress())
          .addAddress(treasureId.toSolidityAddress())
          .addInt256(new BigNumber(10))
      )
      .freezeWith(client)
      .sign(key);
    const initializeTx = await initialize.execute(client);
    const initializeTxRx = await initializeTx.getReceipt(client);
    console.log(` Initialized status : ${initializeTxRx.status}`);
  };

  public pairCurrentPosition = async (
    contId: string,
    client: Client
  ): Promise<[BigNumber, BigNumber]> => {
    const getPairQty = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction("getPairQty")
      .freezeWith(client);
    const getPairQtyTx = await getPairQty.execute(client);
    const response = await getPairQtyTx.getRecord(client);
    const tokenAQty = response.contractFunctionResult!.getInt256(0);
    const tokenBQty = response.contractFunctionResult!.getInt256(1);
    console.log(
      ` ${tokenAQty} units of token A and ${tokenBQty} units of token B are present in the pool. \n`
    );
    return [tokenAQty, tokenBQty];
  };
  public withPrecision = (value: number, precision: number): BigNumber => {
    return new BigNumber(value).multipliedBy(precision);
  };
  public addLiquidity = async (
    contId: string,
    tokenAQty: BigNumber,
    tokenBQty: BigNumber,
    treasureId: AccountId,
    tokenA: TokenId,
    tokenB: TokenId,
    client: Client,
    treasureKey: PrivateKey
  ) => {
    console.log(
      ` Adding ${tokenAQty} units of token A and ${tokenBQty} units of token B to the pool.`
    );
    const addLiquidityTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(9000000)
      .setFunction(
        "addLiquidity",
        new ContractFunctionParameters()
          .addAddress(treasureId.toSolidityAddress())
          .addAddress(tokenA.toSolidityAddress())
          .addAddress(tokenB.toSolidityAddress())
          .addInt256(tokenAQty)
          .addInt256(tokenBQty)
      )
      .freezeWith(client)
      .sign(treasureKey);
    const addLiquidityTxRes = await addLiquidityTx.execute(client);
    const addLiquidityRx = await addLiquidityTxRes.getReceipt(client);

    console.log(` Liquidity added status: ${addLiquidityRx.status}`);
  };

  public getPrecisionValue = async (
    contId: string,
    client: Client
  ): Promise<number> => {
    const getPrecisionValueTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction("getPrecisionValue", new ContractFunctionParameters())
      .freezeWith(client);
    const getPrecisionValueTxRes = await getPrecisionValueTx.execute(client);
    const response = await getPrecisionValueTxRes.getRecord(client);
    const precisionLocal = response.contractFunctionResult!.getInt256(0);
    let precision = Number(precisionLocal);
    console.log(` Get Precision Value ${precision}`);
    return precision;
  };
}
