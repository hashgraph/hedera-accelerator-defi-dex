import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { ContractId, TokenId } from "@hashgraph/sdk";
import dex from "../../deployment/model/dex";
import Pair from "../business/Pair";
import Common from "../business/Common";
import Factory from "../business/Factory";
import { BigNumber } from "bignumber.js";
import { httpRequest } from "../../deployment/api/HttpsService";
import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { CommonSteps } from "./CommonSteps";

const clientManagement = new ClientManagement();
const client = clientManagement.createOperatorClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();
const contractService = new ContractService();
const baseContract = contractService.getContract(
  contractService.hederaServiceContractName
);
const factoryContractId = contractService.getContractWithProxy(
  contractService.factoryContractName
).transparentProxyId!;
const baseContractAddress = baseContract.address;
const { id, key } = clientManagement.getOperator();

const factory = new Factory(factoryContractId);
let pair: Pair;
let tokenOne: TokenId;
let tokenTwo: TokenId;
let expectedPairAddress: string;
let actualPairAddress: string;
let pairCountBefore: string[];
let pairCountAfter: string[];
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);
let fees: BigNumber;
let tokenAHBARPairAddress: string;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];
let lpTokensInPool: Long;
let lpTokenContractId: string;
let lpTokenQty: BigNumber;
let tokenAQty: BigNumber;
let slippageOutGivenIn: BigNumber;
let slippageInGivenOut: BigNumber;
let precision: BigNumber;
let pairContractId: any;
let errorMsg: string = "";
let sportPrice: BigNumber;
let tokenNameIdMap = new Map();
let pairAdd: any;
let lpTokenAdd: string;
let pairWithSameTokenAndFeeAddress: string;

@binding()
export class FactorySteps {
  @given(/User have setup the factory/, undefined, 30000)
  public async setUpFactory(): Promise<void> {
    console.log(
      "*******************Starting factory test with following credentials*******************"
    );
    const adminAddress = clientManagement
      .getAdmin()
      .adminId.toSolidityAddress();
    console.log("Factory contractId : ", factoryContractId);
    console.log("H address : ", baseContractAddress);
    console.log("adminAddress : ", adminAddress);
    console.log("TOKEN_USER_ID : ", id.toString());
    console.log("TREASURE_ID :", treasureId.toString());
    try {
      await factory.setupFactory();
    } catch (error) {}
  }

  @when(
    /User create a new pair of tokens with name "([^"]*)" and "([^"]*)" and with fee as (-?\d+\.\d+)%/,
    undefined,
    60000
  )
  public async createNewPair(
    firstToken: string,
    secondToken: string,
    fee: number
  ): Promise<void> {
    tokenOne = await Common.createToken(
      firstToken,
      firstToken,
      id,
      key,
      client
    );
    tokenTwo = await Common.createToken(
      secondToken,
      secondToken,
      id,
      key,
      client
    );
    fees = new BigNumber(fee * 100);
    actualPairAddress = await factory.createPair(
      tokenOne,
      tokenTwo,
      id,
      key,
      client,
      fees
    );
    tokenNameIdMap.set(firstToken, tokenOne);
    tokenNameIdMap.set(secondToken, tokenTwo);
    const pairAddress = await factory.getPair(tokenOne, tokenTwo);
    pairContractId = await this.fetchContractID(pairAddress);
  }

  @then(
    /User verify address of pair is same to address received after pair creation/,
    undefined,
    30000
  )
  public async getPair(): Promise<void> {
    expectedPairAddress = await factory.getPair(
      tokenOne,
      tokenTwo,
      fees,
      client
    );
    expect(actualPairAddress).to.eql(expectedPairAddress);
  }

  @when(/User get all pairs of tokens/, undefined, 30000)
  public async getAllPairs(): Promise<void> {
    pairCountBefore = await factory.getPairs(client);
  }

  @then(/User verifies count of pairs is increased by 1/, undefined, 30000)
  public async verifyPairCount(): Promise<void> {
    pairCountAfter = await factory.getPairs(client);
    expect(pairCountAfter.length).to.eql(pairCountBefore.length + 1);
  }

  @when(/User create a new pair with same tokens/, undefined, 30000)
  public async createPairWithSameTokens(): Promise<void> {
    actualPairAddress = await factory.createPair(
      tokenOne,
      tokenTwo,
      id,
      key,
      client
    );
  }

  @when(/User create tokens with same name "([^"]*)"/, undefined, 30000)
  public async createTokenWithSameName(tokenName: string): Promise<void> {
    tokenOne = await Common.createToken(tokenName, tokenName, id, key, client);
    tokenTwo = await Common.createToken(tokenName, tokenName, id, key, client);
  }

  @then(/User verifies their address are different/, undefined, 30000)
  public async verifyAddressOfPairWithSameToken(): Promise<void> {
    expect(tokenOne.toSolidityAddress()).not.to.eql(
      tokenTwo.toSolidityAddress()
    );
  }

  @when(/User create a new token with name "([^"]*)"/, undefined, 60000)
  public async createSingleToken(tokenName: string): Promise<void> {
    tokenOne = await Common.createToken(tokenName, tokenName, id, key, client);
    tokenNameIdMap.set(tokenName, tokenOne);
  }

  @then(
    /User gets message "([^"]*)" on creating pair with same token/,
    undefined,
    30000
  )
  public async userVerifyErrorMessage(msg: string): Promise<void> {
    try {
      await factory.createPair(tokenOne, tokenOne, id, key, client);
    } catch (e: any) {
      expect(e.message).contains(msg);
    }
  }

  @when(/User create pair of "([^"]*)" and HBAR/, undefined, 30000)
  public async createPairOfTokenAWithHBAR(tokenName: string): Promise<void> {
    tokenOne = await Common.createToken(tokenName, tokenName, id, key, client);
    tokenAHBARPairAddress = await factory.createPair(
      tokenOne,
      tokenHBARX,
      treasureId,
      treasureKey,
      client
    );
    tokenNameIdMap.set(tokenName, tokenOne);
    tokenNameIdMap.set("HBAR", tokenHBARX);
    const pairAddress = await factory.getPair(tokenOne, tokenHBARX);
    pairContractId = await this.fetchContractID(pairAddress);
    pair = new Pair(pairContractId);
    lpTokenAdd = await pair.getLpContractAddress();
    precision = await pair.getPrecisionValue(client);
  }

  @when(/User associate token "([^"]*)" to account/)
  public async associateToken(tokenName: string) {
    const tokenId = tokenNameIdMap.get(tokenName);
    Common.associateTokensToAccount(treasureId, [tokenId], client, treasureKey);
  }

  @when(/User associate LPToken with account/, undefined, 30000)
  public async associateLPToken() {
    pairAdd = await pair.getTokenPairAddress();
    const tokenId = TokenId.fromSolidityAddress(pairAdd.lpTokenAddress);
    tokenNameIdMap.set("lptoken", tokenId);
    await Common.associateTokensToAccount(
      clientsInfo.operatorId,
      [TokenId.fromSolidityAddress(pairAdd.lpTokenAddress)],
      clientsInfo.operatorClient,
      clientsInfo.operatorKey
    );
  }

  @when(
    /User adds (\d+\.?\d*) units of "([^"]*)" and (\d+\.?\d*) units of "([^"]*)" token/,
    undefined,
    30000
  )
  public async addLiquidityInPool(
    tokenACount: number,
    firstTokenName: string,
    tokenBCount: number,
    secondTokenName: string
  ): Promise<void> {
    tokenOne = tokenNameIdMap.get(firstTokenName);
    const tokensBeforeFetched = await pair.getPairQty(client);
    pairAdd = await pair.getTokenPairAddress();
    tokensBefore =
      pairAdd.tokenAAddress == tokenOne.toSolidityAddress()
        ? tokensBeforeFetched
        : tokensBeforeFetched.reverse();

    await pair.addLiquidity(
      id,
      key,
      tokenOne,
      tokenACount,
      tokenHBARX,
      tokenBCount,
      precision,
      client
    );
  }

  @then(
    /HBAR and Factory9 balances in the pool are (\d+\.?\d*) units and (\d+\.?\d*) units respectively/,
    undefined,
    30000
  )
  public async verifyTokensInPool(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    const tokenAQty = Common.withPrecision(tokenACount, precision);
    const tokenBQty = Common.withPrecision(tokenBCount, precision);
    tokensAfter = await pair.getPairQty(client);

    expect(tokensAfter[0]).to.eql(BigNumber.sum(tokensBefore[0], tokenAQty));
    expect(tokensAfter[1]).to.eql(BigNumber.sum(tokensBefore[1], tokenBQty));
  }

  @given(/User fetches the count of lptokens from pool/, undefined, 30000)
  public async getLPTokensFromPool(): Promise<void> {
    const { lpTokenAddress } = await pair.getTokenPairAddress(client);
    const lpTokenId = TokenId.fromSolidityAddress(lpTokenAddress);
    lpTokensInPool = await Common.getTokenBalance(id, lpTokenId, client);
  }

  @when(/User gives (\d+\.?\d*) units of lptoken to pool/, undefined, 30000)
  public async returnLPTokensAndRemoveLiquidity(
    lpTokenCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);

    lpTokenQty = Common.withPrecision(lpTokenCount, precision);
    await pair.removeLiquidity(lpTokenQty, id, key, client);
  }

  @then(
    /User verifies (\d+\.?\d*) units of HBAR and (\d+\.?\d*) units of Factory9 are left in pool/,
    undefined,
    30000
  )
  public async verifyTokensLeftInPoolAfterRemovingLiquidity(
    tokenAQuantity: Number,
    tokenBQuantity: Number
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);
    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(tokensAfter[0].dividedBy(withPrecision))).to.eql(
      Number(tokenAQuantity)
    );
    expect(Number(tokensAfter[1].dividedBy(withPrecision))).to.eql(
      Number(tokenBQuantity)
    );
  }

  @given(
    /Factory9 and HBAR are present in pool with quantity (\d+\.?\d*) units and (\d+\.?\d*) units respectively/,
    undefined,
    30000
  )
  public async tokensArePresent(tokenOneQty: number, tokenTwoQty: number) {
    const tokensQty = await pair.getPairQty(client);
    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(tokensQty[1].dividedBy(withPrecision))).to.eql(
      Number(tokenOneQty)
    );
    expect(Number(tokensQty[0].dividedBy(withPrecision))).to.eql(
      Number(tokenTwoQty)
    );
  }

  @when(
    /User make swap of (\d+\.?\d*) unit of "([^"]*)" token with another token in pair with slippage as (\d+\.?\d*)/,
    undefined,
    30000
  )
  public async swapToken(
    tokenCount: number,
    tokenName: string,
    slippage: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);
    const tokenToSwap = tokenNameIdMap.get(tokenName);
    const slippageVal = new BigNumber(slippage).multipliedBy(
      precision.div(100)
    );
    await pair.swapToken(
      tokenToSwap,
      tokenCount,
      id,
      key,
      precision,
      slippageVal,
      client
    );
  }

  @then(
    /HBAR token quantity is (\d+\.?\d*) and Factory9 quantity is (\d+\.?\d*) in pool/,
    undefined,
    30000
  )
  public async verifyTokenAQtyIncreasedAndTokenBQtyDecreased(
    tokenAQuantity: BigNumber,
    tokenBQuantity: BigNumber
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);

    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(tokensAfter[0].dividedBy(withPrecision))).to.eql(
      Number(tokenAQuantity)
    );
    expect(Number(tokensAfter[1].dividedBy(withPrecision))).to.eql(
      Number(tokenBQuantity)
    );
  }

  @when(/User update the slippage value to (\d+\.?\d*)/, undefined, 30000)
  public async setSlippageVal(slippage: number): Promise<void> {
    const slippageWithPrecision = Common.withPrecision(slippage, precision);
    pair.setSlippage(slippageWithPrecision, client);
  }

  @then(
    /User gets message "([^"]*)" on creating pair with two HBAR tokens/,
    undefined,
    30000
  )
  public async verifyErrorMessageOnPairCreationWithTwoHBAR(
    msg: string
  ): Promise<void> {
    try {
      await factory.createPair(tokenHBARX, tokenHBARX, id, key, client);
    } catch (e: any) {
      expect(e.message).contains(msg);
    }
  }

  @when(/User gives (\d+\.?\d*) units of HBAR to the pool/, undefined, 30000)
  public async calculateTokenAQtyForGivenTokenBQty(tokenHBARCount: number) {
    const tokenHBARQty = Common.withPrecision(tokenHBARCount, precision);
    tokenAQty = await pair.getInGivenOut(tokenHBARQty, client);
  }

  @then(
    /Expected quantity of Factory9 token should be (\d+\.?\d*)/,
    undefined,
    30000
  )
  public async verifyTokenAQty(expectedTokenAQty: string) {
    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(tokenAQty.dividedBy(withPrecision))).to.eql(
      Number(expectedTokenAQty)
    );
  }

  @when(
    /User gives (\d+\.?\d*) units of Factory9 to calculate slippage out/,
    undefined,
    30000
  )
  public async calculateSlippageOut(tokenACount: number) {
    const tokenAQty = Common.withPrecision(tokenACount, precision);
    slippageOutGivenIn = await pair.slippageOutGivenIn(tokenAQty, client);
  }

  @then(/Slippage out value should be (\d+\.?\d*)/, undefined, 30000)
  public async verifySlippageOut(expectedSlippageOut: number) {
    expect(Number(slippageOutGivenIn)).to.eql(Number(expectedSlippageOut));
  }

  @when(
    /User gives (\d+\.?\d*) units of HBAR to calculate slippage in/,
    undefined,
    30000
  )
  public async calculateSlippageIn(tokenHBARCount: number) {
    const tokenBQty = Common.withPrecision(tokenHBARCount, precision);
    slippageInGivenOut = await pair.slippageInGivenOut(tokenBQty, client);
  }

  @then(/Slippage in value should be (\d+\.?\d*)/, undefined, 30000)
  public async verifySlippageIn(expectedSlippageIn: string) {
    expect(Number(slippageInGivenOut)).to.eql(Number(expectedSlippageIn));
  }

  @then(
    /User verifies balance of "([^"]*)" token from contract is (\d+\.?\d*)/,
    undefined,
    30000
  )
  public async fetchTokenBalanceFromContract(
    tokenName: string,
    tokenQty: number
  ) {
    const tokenId = tokenNameIdMap.get(tokenName);
    let tokenBalance: number;
    if (tokenName === "HBAR") {
      tokenBalance = Number(
        await Common.getAccountBalance(pairContractId, [tokenId], client)
      );
    } else {
      tokenBalance = Number(
        await Common.getTokenBalance(pairContractId, tokenId, client)
      );
    }
    const withPrecision = Number(Common.withPrecision(1, precision));
    console.log("pairContractID -", pairContractId.toString());
    console.log(
      `token name is - ${tokenName} tokenId is - ${tokenId} and tokenBalance is - ${tokenBalance}`
    );
    expect(Number(tokenBalance / withPrecision)).to.eql(Number(tokenQty));
  }

  @when(
    /User create a new pair with tokens "([^"]*)" and "([^"]*)" and with fee as (-?\d+\.\d+)%/,
    undefined,
    30000
  )
  public async createPairWithExistingTokens(
    firstTokenName: string,
    secondTokenName: string,
    feeAmt: number
  ) {
    const tokenOne = tokenNameIdMap.get(firstTokenName);
    const tokenTwo = tokenNameIdMap.get(secondTokenName);
    fees = new BigNumber(feeAmt * 100);
    try {
      actualPairAddress = await factory.createPair(
        tokenOne,
        tokenTwo,
        id,
        key,
        client,
        fees
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(
    /User create pair with tokens "([^"]*)" and "([^"]*)" and with fee as (\d+\.?\d*)%/,
    undefined,
    30000
  )
  public async createPairWithSameTokenAndSameFee(
    firstTokenName: string,
    secondTokenName: string,
    feeAmt: number
  ) {
    const tokenOne = tokenNameIdMap.get(firstTokenName);
    const tokenTwo = tokenNameIdMap.get(secondTokenName);
    fees = new BigNumber(feeAmt * 100);
    pairWithSameTokenAndFeeAddress = await factory.createPair(
      tokenOne,
      tokenTwo,
      id,
      key,
      client,
      fees
    );
  }

  @then(
    /User verify address received is same as of already created pair address/
  )
  public async verifyAddressIsSame() {
    expect(actualPairAddress).to.eql(pairWithSameTokenAndFeeAddress);
  }

  @then(/User receive error message "([^"]*)"/, undefined, 30000)
  public async verifyErrorMsg(msg: string) {
    expect(errorMsg).contains(msg);
    errorMsg = "";
  }

  @when(/User get spot price for "([^"]*)"/, undefined, 30000)
  public async fetchSpotPriceForTokenA(tokenName: string) {
    const tokenId = tokenNameIdMap.get(tokenName);
    sportPrice = await pair.getSpotPrice(tokenId, client);
  }

  @then(/Expected spot price should be (\d+\.?\d*)/, undefined, 30000)
  public async verifySportPriceISNotZero(expectedSpotPrice: string) {
    expect(Number(sportPrice)).to.eql(Number(expectedSpotPrice));
  }

  @when(
    /User sets allowance amount as (\d+\.?\d*) for token "([^"]*)"/,
    undefined,
    30000
  )
  public async setAllowanceForToken(allowanceAmt: number, tokenName: string) {
    const tokenId = tokenNameIdMap.get(tokenName);

    const contractId =
      tokenName === "lptoken"
        ? ContractId.fromSolidityAddress(lpTokenAdd).toString()
        : pairContractId;
    await Common.setTokenAllowance(
      tokenId,
      contractId,
      allowanceAmt * CommonSteps.withPrecision,
      id,
      key,
      client
    );
  }

  private async fetchContractID(pairAddress: string): Promise<ContractId> {
    await Helper.delay(15000);
    const response = await httpRequest(pairAddress, undefined);
    return response.contract_id;
  }
}
