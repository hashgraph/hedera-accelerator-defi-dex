import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import Pair from "../business/Pair";
import LpToken from "../business/LpToken";
import Common from "../business/Common";

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
const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;

const pair = new Pair(pairContract.transparentProxyId!);
const lpToken = new LpToken(lpTokenContract.transparentProxyId!);

let tokenA: TokenId;
let tokenB: TokenId;
let lpTokenProxyId: string;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];
let lpTokensInPool: BigNumber;
let lpTokenQty: BigNumber;
let sportPriceTokenA: BigNumber;
let varaintVal: BigNumber;
let tokenAQty: BigNumber;
let slippageOutGivenIn: BigNumber;
let slippageInGivenOut: BigNumber;
let lpTokenSymbol: string;
let lpTokenName: string;
@binding()
export class PairTestSteps {
  @given(/User create two new tokens/, undefined, 30000)
  public async createTokenPairAndInitializeThem(): Promise<void> {
    console.log(
      "*******************Starting pair test with following credentials*******************"
    );
    console.log("TOKEN_USER_ID : ", id);
    console.log("treasureId :", treasureId);
    const num = Math.floor(Math.random() * 10) + 1;
    tokenA = await Common.createToken("A" + num, "A" + num, id, key, client);
    tokenB = await Common.createToken("B" + num, "B" + num, id, key, client);
    this.createLPTokenName();
  }

  @when(
    /User adds (\d*) units of tokenA and (\d*) units of tokenB/,
    undefined,
    30000
  )
  public async addLiquidity(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);
    const precision = await pair.getPrecisionValue(client);
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
    /tokenA and tokenB balances in the pool are (\d*) units and (\d*) units respectively/,
    undefined,
    30000
  )
  public async verifyTokensInPool(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    const precision = await pair.getPrecisionValue(client);
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

  @when(/User returns (\d*) units of lptoken/, undefined, 30000)
  public async returnLPTokensAndRemoveLiquidity(
    lpTokenCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);
    const precision = await pair.getPrecisionValue(client);
    lpTokenQty = Common.withPrecision(lpTokenCount, precision);
    await pair.removeLiquidity(lpTokenQty, id, key, client);
  }

  @then(
    /User verifies (\d*) units of tokenA and (\d*) units of tokenB are left in pool/,
    undefined,
    30000
  )
  public async verifyTokensLeftInPoolAfterRemovingLiquidity(
    tokenAQuantity: Number,
    tokenBQuantity: Number
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);
    const precision = await pair.getPrecisionValue(client);
    const withPrecision = Common.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @given(/tokenA and tokenB are present in pool/, undefined, 30000)
  public async tokensArePresent(): Promise<void> {
    const tokensQty = await pair.getPairQty(client);
    expect(Number(tokensQty[0])).to.greaterThan(0);
    expect(Number(tokensQty[1])).to.greaterThan(0);
  }

  @when(/User swap (\d*) unit of tokenA/, undefined, 30000)
  public async swapTokenA(tokenACount: number): Promise<void> {
    const precision = await pair.getPrecisionValue(client);
    const slippage = new BigNumber(0);
    await pair.swapToken(
      tokenA,
      tokenACount,
      id,
      key,
      precision,
      slippage,
      client
    );
  }

  @then(
    /increased tokenA quantity is (\d*) and decreased tokenB quantity is (\d*) in pool/,
    undefined,
    30000
  )
  public async verifyTokenAQtyIncreasedAndTokenBQtyDecreased(
    tokenAQuantity: BigNumber,
    tokenBQuantity: BigNumber
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);
    const precision = await pair.getPrecisionValue(client);
    const withPrecision = Common.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @when(/User fetch spot price for tokenA/, undefined, 30000)
  public async fetchSpotPriceForTokenA() {
    sportPriceTokenA = await pair.getSpotPrice(client);
  }

  @then(/Expected spot price for tokenA should be (\d*)/, undefined, 30000)
  public async verifySportPriceISNotZero(expectedSpotPrice: string) {
    expect(Number(sportPriceTokenA)).to.eql(Number(expectedSpotPrice));
  }

  @when(/User gives (\d*) units of tokenB to the pool/, undefined, 30000)
  public async calculateTokenAQtyForGivenTokenBQty(tokenBCount: number) {
    const precision = await pair.getPrecisionValue(client);
    const tokenBQty = Common.withPrecision(tokenBCount, precision);
    tokenAQty = await pair.getInGivenOut(tokenBQty, client);
  }

  @then(/Expected tokenA quantity should be (\d*)/, undefined, 30000)
  public async verifyTokenAQty(expectedTokenAQty: string) {
    const precision = await pair.getPrecisionValue(client);
    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(Number(tokenAQty.dividedBy(withPrecision)).toFixed())).to.eql(
      Number(expectedTokenAQty)
    );
  }

  @when(
    /User gives (\d*) units of tokenA for calculating slippage out/,
    undefined,
    30000
  )
  public async calculateSlippageOut(tokenACount: number) {
    const precision = await pair.getPrecisionValue(client);
    const tokenAQty = Common.withPrecision(tokenACount, precision);
    slippageOutGivenIn = await pair.slippageOutGivenIn(tokenAQty, client);
  }

  @then(/Expected slippage out value should be (\d*)/, undefined, 30000)
  public async verifySlippageOut(expectedSlippageOut: string) {
    expect(Number(slippageOutGivenIn)).to.eql(Number(expectedSlippageOut));
  }

  @when(
    /User gives (\d*) units of tokenB for calculating slippage in/,
    undefined,
    30000
  )
  public async calculateSlippageIn(tokenBCount: number) {
    const precision = await pair.getPrecisionValue(client);
    const tokenBQty = await Common.withPrecision(tokenBCount, precision);
    slippageInGivenOut = await pair.slippageInGivenOut(tokenBQty, client);
  }

  @then(/Expected slippage in value should be (\d*)/, undefined, 30000)
  public async verifySlippageIn(expectedSlippageIn: string) {
    expect(Number(slippageInGivenOut)).to.eql(Number(expectedSlippageIn));
  }

  @when(/User initialize lptoken contract/, undefined, 30000)
  public async initializeLPTokenContract(): Promise<void> {
    await lpToken.initialize(
      htsServiceAddress,
      lpTokenName,
      lpTokenSymbol,
      client
    );
  }

  @when(/User initialize pair contract/, undefined, 30000)
  public async initializePairOfTokens(): Promise<void> {
    console.log("Initializing pair contract with following");
    console.log("contractId : ", pair.contractId);
    console.log("treasureId : ", treasureId);
    console.log(
      "lpTokenContract.transparentProxyAddress : ",
      lpTokenContract.transparentProxyAddress
    );
    await pair.initialize(
      htsServiceAddress,
      lpTokenContract.transparentProxyAddress!,
      treasureId,
      treasureKey,
      tokenA,
      tokenB,
      client
    );
  }

  @when(/User set (\d*) as the slippage value/, undefined, 30000)
  public async setSlippageVal(slippage: number): Promise<void> {
    const precision = await pair.getPrecisionValue(client);
    const slippageWithPrecision = Common.withPrecision(slippage, precision);
    pair.setSlippage(slippageWithPrecision, client);
  }

  @when(
    /User define lptoken name and symbol for newly created tokens/,
    undefined,
    30000
  )
  public async createLPTokenName(): Promise<void> {
    const tokenADetail = await Common.getTokenInfo(tokenA.toString(), client);
    const tokenBDetail = await Common.getTokenInfo(tokenB.toString(), client);
    const symbols = [tokenADetail.symbol, tokenBDetail.symbol];
    symbols.sort();
    lpTokenSymbol = symbols[0] + "-" + symbols[1];
    lpTokenName = lpTokenSymbol + " name";
  }
}
