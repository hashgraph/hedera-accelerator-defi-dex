import Base from "./Base";
import Common from "./Common";
import dex from "../../deployment/model/dex";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  TokenId,
  ContractFunctionParameters,
  PrivateKey,
  Client,
  AccountId,
} from "@hashgraph/sdk";

const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

const INITIALIZE = "initialize";
const SWAP_TOKEN = "swapToken";
const GET_PAIR_QTY = "getPairQty";
const SET_SLIPPAGE = "setSlippage";
const GET_SPOT_PRICE = "getSpotPrice";
const GET_OUT_GIVEN_IN = "getOutGivenIn";
const GET_IN_GIVEN_OUT = "getInGivenOut";
const GET_TOKEN_PAIR_ADDRESS = "getTokenPairAddress";
const LP_CONTRACT_ADDRESS = "getLpTokenContractAddress";

const ADD_LIQUIDITY = "addLiquidity";
const REMOVE_LIQUIDITY = "removeLiquidity";

const VARIANT_VALUE = "getVariantValue";
const PRECISION_VALUE = "getPrecisionValue";
const SLIPPAGE_IN_GIVEN_OUT = "slippageInGivenOut";
const SLIPPAGE_OUT_GIVEN_IN = "slippageOutGivenIn";

export default class Pair extends Base {
  public initialize = async (
    lpTokenContractAddress: string,
    feeCollectionAccountId: AccountId,
    tokensOwnerKey: PrivateKey,
    tokenA: TokenId,
    tokenB: TokenId,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(this.htsAddress)
      .addAddress(lpTokenContractAddress)
      .addAddress(tokenA.toSolidityAddress())
      .addAddress(tokenB.toSolidityAddress())
      .addAddress(feeCollectionAccountId.toSolidityAddress())
      .addInt256(new BigNumber(10));
    await this.execute(INITIALIZE, client, args, tokensOwnerKey);
    console.log(`- Pair#${INITIALIZE}(): done\n`);
  };

  public getLpContractAddress = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(LP_CONTRACT_ADDRESS, client);
    const address = result.getAddress(0);
    console.log(`- Pair#${LP_CONTRACT_ADDRESS}(): address = ${address}\n`);
    return address;
  };

  public getPairQty = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(GET_PAIR_QTY, client);
    const tokenQty = result.getInt256(0);
    const tokenBQty = result.getInt256(1);
    console.log(
      `- Pair#${GET_PAIR_QTY}(): quantities = ${tokenQty} x ${tokenBQty}\n`
    );
    return [tokenQty, tokenBQty];
  };

  public getPrecisionValue = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(PRECISION_VALUE, client);
    const precision = result.getInt256(0);
    console.log(`- Pair#${PRECISION_VALUE}(): precision = ${precision}\n`);
    return precision;
  };

  public setSlippage = async (
    slippage: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addInt256(slippage);
    await this.execute(SET_SLIPPAGE, client, args);
    console.log(`- Pair#${SET_SLIPPAGE}(): done\n`);
  };

  public getSpotPrice = async (client: Client = clientsInfo.operatorClient) => {
    const { result } = await this.execute(GET_SPOT_PRICE, client);
    const price = result.getInt256(0);
    console.log(`- Pair#${GET_SPOT_PRICE}(): TokenA spot price = ${price}\n`);
    return price;
  };

  public getVariantValue = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(VARIANT_VALUE, client);
    const price = result.getInt256(0);
    console.log(`- Pair#${VARIANT_VALUE}(): k = ${price}\n`);
    return price;
  };

  public getOutGivenIn = async (
    tokenQty: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addInt256(tokenQty);
    const { result } = await this.execute(GET_OUT_GIVEN_IN, client, args);
    const tokenBQty = result.getInt256(0);
    console.log(
      `- Pair#${GET_OUT_GIVEN_IN}(): For tokenQty ${tokenQty} the getOutGivenIn tokenBQty is ${tokenBQty}\n`
    );
    return tokenBQty;
  };

  public getInGivenOut = async (
    tokenBQty: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addInt256(tokenBQty);
    const { result } = await this.execute(GET_IN_GIVEN_OUT, client, args);
    const tokenQty = result.getInt256(0);
    console.log(
      `- Pair#${GET_IN_GIVEN_OUT}(): For tokenBQty ${tokenBQty} the getInGivenOut tokenQty is ${tokenQty}\n`
    );
    return tokenQty;
  };

  public slippageOutGivenIn = async (
    tokenQty: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addInt256(tokenQty);
    const { result } = await this.execute(SLIPPAGE_OUT_GIVEN_IN, client, args);
    const tokenBQty = result.getInt256(0);
    console.log(
      `- Pair#${SLIPPAGE_OUT_GIVEN_IN}(): for tokenQty = ${tokenQty} the slippageOutGivenIn tokenBQty = ${tokenBQty}\n`
    );
    return tokenBQty;
  };

  public slippageInGivenOut = async (
    tokenBQty: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters().addInt256(tokenBQty);
    const { result } = await this.execute(SLIPPAGE_IN_GIVEN_OUT, client, args);
    const tokenQty = result.getInt256(0);
    console.log(
      `- Pair#${SLIPPAGE_IN_GIVEN_OUT}(): for tokenBQty = ${tokenBQty} the slippageInGivenOut tokenQty = ${tokenQty}\n`
    );
    return tokenQty;
  };

  public getTokenPairAddress = async (
    client: Client = clientsInfo.operatorClient
  ) => {
    const { result } = await this.execute(GET_TOKEN_PAIR_ADDRESS, client);
    const tokenAAddress = result.getAddress(0);
    const tokenBAddress = result.getAddress(1);
    const lpTokenAddress = result.getAddress(2);
    console.log(`- Pair#${GET_TOKEN_PAIR_ADDRESS}():`);
    console.log(` - A Token Address = ${tokenAAddress}`);
    console.log(` - B Token Address = ${tokenBAddress}`);
    console.log(` - Lp Token Address = ${lpTokenAddress}\n`);
    return { tokenAAddress, tokenBAddress, lpTokenAddress };
  };

  public addLiquidity = async (
    tokenOwnerId: AccountId,
    tokenOwnerKey: PrivateKey,
    tokenA: TokenId,
    tokenAQty: BigNumber | number,
    tokenB: TokenId,
    tokenBQty: BigNumber | number,
    precision: BigNumber | number,
    client: Client
  ) => {
    const hBars = this.calculateHBars(tokenA, tokenB, tokenAQty, tokenBQty);
    const tokenAQty1 = this.calculateQty(tokenA, tokenAQty, precision);
    const tokenBQty1 = this.calculateQty(tokenB, tokenBQty, precision);
    const args = new ContractFunctionParameters()
      .addAddress(tokenOwnerId.toSolidityAddress())
      .addAddress(tokenA.toSolidityAddress())
      .addAddress(tokenB.toSolidityAddress())
      .addInt256(tokenAQty1)
      .addInt256(tokenBQty1);
    await this.execute(ADD_LIQUIDITY, client, args, tokenOwnerKey, hBars);
    console.log(
      `- Pair#${ADD_LIQUIDITY}(): HBars = ${hBars}, TokenId = ${tokenA}, Qty = ${tokenAQty1}, TokenId = ${tokenB}, Qty = ${tokenBQty1}\n`
    );
  };

  public removeLiquidity = async (
    lpTokenQty: BigNumber,
    tokenReceiverId: AccountId,
    tokenReceiverKey: PrivateKey,
    client: Client = clientsInfo.operatorClient
  ) => {
    const args = new ContractFunctionParameters()
      .addAddress(tokenReceiverId.toSolidityAddress())
      .addInt256(lpTokenQty);
    await this.execute(REMOVE_LIQUIDITY, client, args, tokenReceiverKey);
    console.log(`- Pair#${REMOVE_LIQUIDITY}(): LpTokenQty = ${lpTokenQty}\n`);
  };

  public swapToken = async (
    token: TokenId,
    tokenQty: number,
    tokenOwnerId: AccountId,
    tokenOwnerKey: PrivateKey,
    precision: BigNumber | number,
    slippage: BigNumber,
    client: Client = clientsInfo.operatorClient
  ) => {
    const hBars = this.calculateHBar(token, tokenQty);
    const tokenQtyA = this.calculateQty(token, tokenQty, precision);
    const args = new ContractFunctionParameters()
      .addAddress(tokenOwnerId.toSolidityAddress())
      .addAddress(token.toSolidityAddress())
      .addInt256(tokenQtyA)
      .addInt256(slippage);
    await this.execute(SWAP_TOKEN, client, args, tokenOwnerKey, hBars);
    console.log(
      `- Pair#${SWAP_TOKEN}(): hBars = ${hBars}, TokenId = ${token}, Qty = ${tokenQtyA}\n`
    );
  };

  private calculateQty(
    token: TokenId,
    tokenQty: BigNumber | number,
    precision: BigNumber | number
  ): BigNumber {
    return this.isHBarXToken(token)
      ? BigNumber(0)
      : Common.withPrecision(tokenQty, precision);
  }

  private calculateHBars(
    tokenA: TokenId,
    tokenB: TokenId,
    tokenAQty: BigNumber | number,
    tokenBQty: BigNumber | number
  ) {
    return this.isHBarXToken(tokenA)
      ? tokenAQty
      : this.isHBarXToken(tokenB)
      ? tokenBQty
      : 0;
  }

  private calculateHBar(token: TokenId, tokenQty: BigNumber | number) {
    return this.isHBarXToken(token) ? tokenQty : 0;
  }

  private isHBarXToken(token: TokenId) {
    return token.toSolidityAddress() === tokenHBARX.toSolidityAddress();
  }
}
