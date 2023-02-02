import { BigNumber } from "bignumber.js";
import {
  TokenId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
  PrivateKey,
  Client,
  AccountId,
  TokenInfoQuery,
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
      .execute(client);

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
    htsServiceAddress: string,
    tokenSymbol: string,
    tokenName: string
  ) => {
    console.log(`Initialize LP contract with lp contract ${lpTokenContractId}`);
    let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(htsServiceAddress)
      .addString(tokenSymbol)
      .addString(tokenName);
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
    treasureKey: PrivateKey,
    hbar: number
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
      .setPayableAmount(new Hbar(hbar))
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

  public getAllLPTokenCount = async (
    contId: string,
    client: Client,
    key: PrivateKey,
    treasureKey: PrivateKey
  ): Promise<BigNumber> => {
    console.log(`getAllLPTokenCount`);

    const getAllLPTokenCountTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setFunction("getAllLPTokenCount")
      .setGas(9000000)
      .freezeWith(client)
      .sign(key);

    const signTx = await getAllLPTokenCountTx.sign(treasureKey);

    const executedTx = await signTx.execute(client);
    const executedRx = await executedTx.getReceipt(client);
    const response = await executedTx.getRecord(client);
    const status = executedRx.status;
    console.log(
      `getAllLPTokenCount code: ${response.contractFunctionResult!.getInt256()}`
    );
    return response.contractFunctionResult!.getInt256();
  };

  public removeLiquidity = async (
    contId: string,
    lpToken: BigNumber,
    treasureId: AccountId,
    client: Client,
    treasureKey: PrivateKey
  ) => {
    console.log(` Removing ${lpToken} units of LPToken from the pool.`);
    const removeLiquidity = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(9000000)
      .setFunction(
        "removeLiquidity",
        new ContractFunctionParameters()
          .addAddress(treasureId.toSolidityAddress())
          .addInt256(lpToken)
      )
      .freezeWith(client)
      .sign(treasureKey);
    const removeLiquidityTx = await removeLiquidity.execute(client);
    const removeLiquidityRx = await removeLiquidityTx.getReceipt(client);
    console.log(` Liquidity remove status: ${removeLiquidityRx.status}`);
  };

  public swapTokenA = async (
    contId: string,
    tokenAQty: BigNumber,
    slippage: BigNumber,
    treasureId: AccountId,
    tokenA: TokenId,
    client: Client,
    treasureKey: PrivateKey,
    key: PrivateKey
  ) => {
    console.log(` Swapping a ${tokenAQty} units of token A from the pool.`);
    const swapToken = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(9990000)
      .setFunction(
        "swapToken",
        new ContractFunctionParameters()
          .addAddress(treasureId.toSolidityAddress())
          .addAddress(tokenA.toSolidityAddress())
          .addInt256(tokenAQty)
          .addInt256(slippage)
      )
      .setPayableAmount(new Hbar(0.1))
      .freezeWith(client)
      .sign(treasureKey);
    const newTrx = await swapToken.sign(key);
    const swapTokenTx = await newTrx.execute(client);
    const swapTokenRx = await swapTokenTx.getReceipt(client);
    console.log(` Swap status: ${swapTokenRx.status}`);
  };

  public setSlippage = async (
    contId: string,
    client: Client,
    slppageVal: BigNumber
  ) => {
    const setSlippageTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction(
        "setSlippage",
        new ContractFunctionParameters().addInt256(slppageVal)
      )
      .freezeWith(client);
    const setSlippageTxResult = await setSlippageTx.execute(client);
    const response = await setSlippageTxResult.getRecord(client);
    const slippage = response.contractFunctionResult!.getInt256(0);

    const setSlippageyRx = await setSlippageTxResult.getReceipt(client);
    console.log(` set slippage status: ${setSlippageyRx.status}`);

    console.log(` Slippage value is -  ${slippage}  \n`);
  };

  public spotPrice = async (
    contId: string,
    client: Client
  ): Promise<BigNumber> => {
    const getSpotPrice = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction("getSpotPrice")
      .freezeWith(client);
    const spotPriceTx = await getSpotPrice.execute(client);
    const response = await spotPriceTx.getRecord(client);
    const price = response.contractFunctionResult!.getInt256(0);
    console.log(` Spot price for token A is ${price}. \n`);
    return price;
  };

  public getVariantValue = async (
    contId: string,
    client: Client
  ): Promise<BigNumber> => {
    const getVariantValue = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction("getVariantValue")
      .freezeWith(client);
    const variantValueTx = await getVariantValue.execute(client);
    const response = await variantValueTx.getRecord(client);
    const price = response.contractFunctionResult!.getInt256(0);
    console.log(` k variant value is ${price}. \n`);
    return price;
  };

  public getInGivenOut = async (
    contId: string,
    tokenBQty: BigNumber,
    client: Client
  ): Promise<BigNumber> => {
    const getInGivenOut = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction(
        "getInGivenOut",
        new ContractFunctionParameters().addInt256(tokenBQty)
      )
      .freezeWith(client);
    const getInGivenOutTx = await getInGivenOut.execute(client);
    const response = await getInGivenOutTx.getRecord(client);
    const tokenAQty = response.contractFunctionResult!.getInt256(0);
    console.log(
      ` For tokenBQty ${tokenBQty} the getInGivenOut tokenAQty is ${tokenAQty}. \n`
    );
    return tokenAQty;
  };

  public slippageOutGivenIn = async (
    contId: string,
    tokenAQty: BigNumber,
    client: Client
  ): Promise<BigNumber> => {
    const slippageOutGivenInTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction(
        "slippageOutGivenIn",
        new ContractFunctionParameters().addInt256(tokenAQty)
      )
      .freezeWith(client);
    const slippageOutGivenInTxResult = await slippageOutGivenInTx.execute(
      client
    );
    const response = await slippageOutGivenInTxResult.getRecord(client);
    const tokenBQty = response.contractFunctionResult!.getInt256(0);

    console.log(
      ` For tokenAQty ${tokenAQty} the slippageOutGivenIn tokenBQty is ${tokenBQty}. \n`
    );
    return tokenBQty;
  };

  public slippageInGivenOut = async (
    contId: string,
    tokenBQty: BigNumber,
    client: Client
  ): Promise<BigNumber> => {
    const slippageInGivenOutTx = await new ContractExecuteTransaction()
      .setContractId(contId)
      .setGas(1000000)
      .setFunction(
        "slippageInGivenOut",
        new ContractFunctionParameters().addInt256(tokenBQty)
      )
      .freezeWith(client);
    const slippageInGivenOuTxResult = await slippageInGivenOutTx.execute(
      client
    );
    const response = await slippageInGivenOuTxResult.getRecord(client);
    const tokenAQty = response.contractFunctionResult!.getInt256(0);

    console.log(
      ` For tokenBQty ${tokenBQty} the slippageInGivenOut tokenAQty is ${tokenAQty}. \n`
    );
    return tokenAQty;
  };

  public tokenQueryFunction = async (
    tokenId: string,
    client: Client
  ): Promise<any> => {
    const response = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    console.log(`- Token name: ${response.name} symbol $${response.symbol}`);
    return { name: response.name, symbol: response.symbol };
  };

  getLpTokenContractAddress = async (pairProxyId: string, client: Client) => {
    const tx = new ContractExecuteTransaction()
      .setContractId(pairProxyId)
      .setGas(1000000)
      .setFunction("getLpTokenContractAddress");
    const txResponse = await tx.execute(client);
    const txRecord = await txResponse.getRecord(client);
    return txRecord.contractFunctionResult!.getAddress(0);
  };
}
