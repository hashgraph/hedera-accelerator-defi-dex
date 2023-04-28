import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement, { clientsInfo } from "../../utils/ClientManagement";
import { TokenId, ContractId, AccountId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import Pair from "../business/Pair";
import LpToken from "../business/LpToken";
import Common from "../business/Common";
import exp from "constants";
import { Helper } from "../../utils/Helper";
import { CommonSteps } from "./CommonSteps";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
const lpTokenContract = contractService.getContractWithProxy(
  contractService.lpTokenContractName
);
const pairContract = contractService.getContractWithProxy(
  contractService.pairContractName
);

const { treasureId, treasureKey } = clientManagement.getTreasure();
const { id, key } = clientManagement.getOperator();
const client = clientManagement.createOperatorClient();

const pair = new Pair(pairContract.transparentProxyId!);
const lpToken = new LpToken(lpTokenContract.transparentProxyId!);
let tokenNameIdMap = new Map();

let tokenA: TokenId;
let tokenB: TokenId;
let lpTokenProxyId: string;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];
let lpTokensInPool: BigNumber;
let lpTokenQty: BigNumber;
let sportPriceOfToken: BigNumber;
let varaintVal: BigNumber;
let tokenAQty: BigNumber;
let slippageOutGivenIn: BigNumber;
let slippageInGivenOut: BigNumber;
let lpTokenSymbol: string;
let lpTokenName: string;
let precision: BigNumber;
let tokenBalanceBeforeSwapWithTreasury: Number;
let feeForSwap: BigNumber;
let errorMsg: string;

@binding()
export class PairTestSteps {
  @given(
    /User create two new tokens with name "([^"]*)" and "([^"]*)"/,
    undefined,
    30000
  )
  public async createTokenPairAndInitializeThem(
    firstTokenName: string,
    secondTokenName: string
  ): Promise<void> {
    console.log(
      "*******************Starting pair test with following credentials*******************"
    );
    console.log("TOKEN_USER_ID : ", id.toString());
    console.log("treasureId :", treasureId.toString());
    tokenA = await Common.createToken(
      firstTokenName,
      firstTokenName,
      id,
      key,
      client
    );
    tokenB = await Common.createToken(
      secondTokenName,
      secondTokenName,
      id,
      key,
      client
    );
    tokenNameIdMap.set(firstTokenName, tokenA);
    tokenNameIdMap.set(secondTokenName, tokenB);
    precision = await pair.getPrecisionValue(client);
  }

  @when(/User associate the LPToken with the account/, undefined, 30000)
  public async associateLPToken() {
    const lpTokenAddress = await lpToken.getLpTokenAddress();
    const tokenId = TokenId.fromSolidityAddress(lpTokenAddress);
    tokenNameIdMap.set("lptoken", tokenId);
    await Common.associateTokensToAccount(
      clientsInfo.operatorId,
      [tokenId],
      clientsInfo.operatorClient,
      clientsInfo.operatorKey
    );
  }

  @when(/User associate the token "([^"]*)" to account/)
  public async associateToken(tokenName: string) {
    const tokenId = tokenNameIdMap.get(tokenName);
    Common.associateTokensToAccount(treasureId, [tokenId], client, treasureKey);
  }

  @when(
    /User adds (-?\d+\.\d+) units of PairToken1 and (-?\d+\.\d+) units of PairToken2/,
    undefined,
    30000
  )
  public async addLiquidity(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);

    await pair.addLiquidity(
      id,
      key,
      tokenA,
      tokenACount,
      tokenB,
      tokenBCount,
      precision,
      client
    );
  }

  @then(
    /PairToken1 and PairToken2 balances in the pool are (-?\d+\.\d+) units and (-?\d+\.\d+) units respectively/,
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

  @given(/User gets the count of lptokens from  pool/, undefined, 30000)
  public async getLPTokensFromPool(): Promise<void> {
    lpTokensInPool = await lpToken.getAllLPTokenCount(client);
  }

  @when(/User returns (-?\d+\.\d+) units of lptoken/, undefined, 30000)
  public async returnLPTokensAndRemoveLiquidity(
    lpTokenCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);
    lpTokenQty = Common.withPrecision(lpTokenCount, precision);
    await pair.removeLiquidity(lpTokenQty, id, key, client);
  }

  @then(
    /User verifies (-?\d+\.\d+) units of PairToken1 and (-?\d+\.\d+) units of PairToken2 are left in pool/,
    undefined,
    30000
  )
  public async verifyTokensLeftInPoolAfterRemovingLiquidity(
    tokenAQuantity: number,
    tokenBQuantity: number
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

  @given(/PairToken1 and PairToken2 are present in pool/, undefined, 30000)
  public async tokensArePresent(): Promise<void> {
    const tokensQty = await pair.getPairQty(client);
    expect(Number(tokensQty[0])).to.greaterThan(0);
    expect(Number(tokensQty[1])).to.greaterThan(0);
  }

  @when(
    /User swap (\d*) unit of token "([^"]*)" with slippage as (-?\d+\.\d+)/,
    undefined,
    30000
  )
  public async swapTokenA(
    tokenCount: number,
    tokenName: string,
    slippage: number
  ): Promise<void> {
    const slippageVal = new BigNumber(slippage).multipliedBy(
      precision.div(100)
    );
    const tokenId = tokenNameIdMap.get(tokenName);
    await pair.swapToken(
      tokenId,
      tokenCount,
      id,
      key,
      precision,
      slippageVal,
      client
    );
    const withPrecision = Common.withPrecision(1, precision);
    const tokenQty = new BigNumber(tokenCount).multipliedBy(withPrecision);
    feeForSwap = await pair.feeForSwap(tokenQty, clientsInfo.operatorClient);
  }

  @then(
    /PairToken1 quantity is (-?\d+\.\d+) and PairToken2 quantity is (-?\d+\.\d+) in pool/,
    undefined,
    30000
  )
  public async verifyTokenAQtyIncreasedAndTokenBQtyDecreased(
    tokenAQuantity: number,
    tokenBQuantity: number
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

  @when(/User fetch spot price for "([^"]*)"/, undefined, 30000)
  public async fetchSpotPriceForTokenA(tokenName: string) {
    const tokenId = tokenNameIdMap.get(tokenName);
    sportPriceOfToken = await pair.getSpotPrice(tokenId, client);
  }

  @then(/Expected spot price for PairToken1 should be (\d*)/, undefined, 30000)
  public async verifySportPriceISNotZero(expectedSpotPrice: string) {
    expect(Number(sportPriceOfToken)).to.eql(Number(expectedSpotPrice));
  }

  @when(/User gives (\d*) units of PairToken2 to the pool/, undefined, 30000)
  public async calculateTokenAQtyForGivenTokenBQty(tokenBCount: number) {
    const tokenBQty = Common.withPrecision(tokenBCount, precision);
    tokenAQty = await pair.getInGivenOut(tokenBQty, client);
  }

  @then(/Expected PairToken1 quantity should be (\d+\.?\d*)/, undefined, 30000)
  public async verifyTokenAQty(expectedTokenAQty: number) {
    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(tokenAQty.dividedBy(withPrecision))).to.eql(
      Number(expectedTokenAQty)
    );
  }

  @when(
    /User gives (\d*) units of PairToken1 for calculating slippage out/,
    undefined,
    30000
  )
  public async calculateSlippageOut(tokenACount: number) {
    const tokenAQty = Common.withPrecision(tokenACount, precision);
    slippageOutGivenIn = await pair.slippageOutGivenIn(tokenAQty, client);
  }

  @then(/Expected slippage out value should be (\d*)/, undefined, 30000)
  public async verifySlippageOut(expectedSlippageOut: string) {
    expect(Number(slippageOutGivenIn)).to.eql(Number(expectedSlippageOut));
  }

  @when(
    /User gives (\d*) units of PairToken2 for calculating slippage in/,
    undefined,
    30000
  )
  public async calculateSlippageIn(tokenBCount: number) {
    const tokenBQty = await Common.withPrecision(tokenBCount, precision);
    slippageInGivenOut = await pair.slippageInGivenOut(tokenBQty, client);
  }

  @then(/Expected slippage in value should be (\d+\.?\d*)/, undefined, 30000)
  public async verifySlippageIn(expectedSlippageIn: number) {
    expect(Number(slippageInGivenOut)).to.eql(Number(expectedSlippageIn));
  }

  @when(/User initialize lptoken contract/, undefined, 30000)
  public async initializeLPTokenContract(): Promise<void> {
    await lpToken.initialize(lpTokenName, lpTokenSymbol, client);
  }

  @when(
    /User initialize pair contract with swap transaction fee as (-?\d+\.\d+)%/,
    undefined,
    30000
  )
  public async initializePairOfTokens(fee: number): Promise<void> {
    console.log("Initializing pair contract with following");
    console.log("contractId : ", pair.contractId);
    console.log("treasureId : ", treasureId.toString());
    console.log(
      "lpTokenContract.transparentProxyAddress : ",
      lpTokenContract.transparentProxyAddress
    );
    await pair.initialize(
      lpTokenContract.transparentProxyAddress!,
      treasureId,
      treasureKey,
      tokenA,
      tokenB,
      new BigNumber(fee * 100),
      client
    );
  }

  @when(/User set (\d*) as the slippage value/, undefined, 30000)
  public async setSlippageVal(slippage: number): Promise<void> {
    const slippageWithPrecision = Common.withPrecision(slippage, precision);
    pair.setSlippage(slippageWithPrecision, client);
  }

  @when(
    /User define lptoken name and symbol for newly created tokens/,
    undefined,
    30000
  )
  public async createLPTokenName(): Promise<void> {
    const data = await Common.createLPTokenName(tokenA, tokenB);
    lpTokenSymbol = data.lpTokenSymbol;
    lpTokenName = data.lpTokenSymbol;
  }

  @then(
    /User verify balance of "([^"]*)" token with contract is (-?\d+\.\d+)/,
    undefined,
    30000
  )
  public async verifyTokenBalanceFromContract(
    tokenName: string,
    tokenQty: number
  ) {
    const tokenId = tokenNameIdMap.get(tokenName);
    const tokenBalance = Number(
      await Common.getTokenBalance(
        ContractId.fromString(pair.contractId),
        tokenId,
        client
      )
    );
    const withPrecision = Number(Common.withPrecision(1, precision));
    expect(Number(tokenBalance / withPrecision)).to.eql(Number(tokenQty));
  }

  @then(
    /User verify "([^"]*)" balance with treasury is (\d+\.\d+)/,
    undefined,
    30000
  )
  public async verifyTokenBalanceWithTreasury(
    tokenName: string,
    balance: number
  ) {
    const tokenId = tokenNameIdMap.get(tokenName);
    const tokenBalanceAfterSwapWithTreasury = Number(
      await Common.getTokenBalance(treasureId, tokenId, client)
    );

    const withPrecision = Number(Common.withPrecision(1, precision));
    const actualBal = Number(tokenBalanceAfterSwapWithTreasury / withPrecision);
    const eligibleAmtForTreasury =
      Number(feeForSwap.dividedBy(withPrecision)) / 2;
    expect(actualBal).to.eql(Number(balance));
    expect(eligibleAmtForTreasury).to.eql(actualBal);
  }

  @when(
    /User tries to initialize the pair contract with same tokens and same fee as (-?\d+\.\d+)%/,
    undefined,
    30000
  )
  public async initializeWithSameTokenAndFee(fee: number) {
    try {
      await pair.initialize(
        lpTokenContract.transparentProxyAddress!,
        treasureId,
        treasureKey,
        tokenA,
        tokenB,
        new BigNumber(fee * 100),
        client
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @then(/User receive error message "([^"]*)"/)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
  }

  @then(
    /Balance of "([^"]*)" and "([^"]*)" in user account is (\d+\.?\d*) and (\d+\.?\d*) respectively/,
    undefined,
    30000
  )
  public async verifyTokenBalance(
    firstTokenName: string,
    secondTokenName: string,
    firstTokenAmt: number,
    secondTokenAmt: number
  ) {
    await Helper.delay(10000);
    const firstTokenId = tokenNameIdMap.get(firstTokenName);
    const secondTokenId = tokenNameIdMap.get(secondTokenName);
    const firstTokenBalance = Number(
      await Common.getTokenBalance(id, firstTokenId, client)
    );
    const secondTokenBalance = Number(
      await Common.getTokenBalance(id, secondTokenId, client)
    );

    expect(firstTokenBalance / Number(precision)).to.eql(Number(firstTokenAmt));
    expect(secondTokenBalance / Number(precision)).to.eql(
      Number(secondTokenAmt)
    );
  }

  @when(
    /User set allowance amount as (\d+\.?\d*) for token "([^"]*)"/,
    undefined,
    30000
  )
  public async setAllowanceForToken(allowanceAmt: number, tokenName: string) {
    const tokenId = tokenNameIdMap.get(tokenName);
    const contractId =
      tokenName === "lptoken"
        ? lpTokenContract.transparentProxyId!
        : pairContract.transparentProxyId!;
    await Common.setTokenAllowance(
      tokenId,
      contractId,
      allowanceAmt * CommonSteps.withPrecision,
      id,
      key,
      client
    );
  }
}
