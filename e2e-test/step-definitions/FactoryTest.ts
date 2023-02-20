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

const clientManagement = new ClientManagement();
const client = clientManagement.createOperatorClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();
const contractService = new ContractService();
const baseContract = contractService.getContract(
  contractService.baseContractName
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
const fees = new BigNumber(10);
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
let tokenNameIdMap = new Map();

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
    console.log("BaseHts address : ", baseContractAddress);
    console.log("adminAddress : ", adminAddress);
    console.log("TOKEN_USER_ID : ", id.toString());
    console.log("TREASURE_ID :", treasureId.toString());
    try {
      await factory.setupFactory();
    } catch (error) {}
  }

  @when(
    /User create a new pair of tokens with name "([^"]*)" and "([^"]*)"/,
    undefined,
    60000
  )
  public async createNewPair(
    firstToken: string,
    secondToken: string
  ): Promise<void> {
    // const num = Math.floor(Math.random() * 100) + 1;
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
    actualPairAddress = await factory.createPair(
      tokenOne,
      tokenTwo,
      id,
      key,
      client
    );
    tokenNameIdMap.set(firstToken, tokenOne);
    tokenNameIdMap.set(secondToken, tokenTwo);
    const pairAddress = await factory.getPair(tokenOne, tokenTwo, client);
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
    const pairAddress = await factory.getPair(tokenOne, tokenHBARX, client);
    pairContractId = await this.fetchContractID(pairAddress);
    pair = new Pair(pairContractId);
    precision = await pair.getPrecisionValue(client);
  }

  @when(
    /User adds (\d*) units of "([^"]*)" and (\d*) units of "([^"]*)" token/,
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
    const pairAdd = await pair.getTokenPairAddress();
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
    /HBAR and Factory9 balances in the pool are (\d*) units and (\d*) units respectively/,
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

  @when(/User gives (\d*) units of lptoken to pool/, undefined, 30000)
  public async returnLPTokensAndRemoveLiquidity(
    lpTokenCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);

    lpTokenQty = Common.withPrecision(lpTokenCount, precision);
    await pair.removeLiquidity(lpTokenQty, id, key, client);
  }

  @then(
    /User verifies (\d*) units of HBAR and (\d*) units of Factory9 are left in pool/,
    undefined,
    30000
  )
  public async verifyTokensLeftInPoolAfterRemovingLiquidity(
    tokenAQuantity: Number,
    tokenBQuantity: Number
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);
    const withPrecision = Common.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @given(/Factory9 and HBAR are present in pool/, undefined, 30000)
  public async tokensArePresent() {
    const tokensQty = await pair.getPairQty(client);
    expect(Number(tokensQty[0])).to.greaterThan(0);
    expect(Number(tokensQty[1])).to.greaterThan(0);
  }

  @when(
    /User make swap of (\d*) unit of "([^"]*)" token with another token in pair/,
    undefined,
    30000
  )
  public async swapToken(tokenCount: number, tokenName: string): Promise<void> {
    tokensBefore = await pair.getPairQty(client);
    const tokenToSwap = tokenNameIdMap.get(tokenName);
    const slippage = new BigNumber(0);
    await pair.swapToken(
      tokenToSwap,
      tokenCount,
      id,
      key,
      precision,
      slippage,
      client
    );
  }

  @then(
    /HBAR token quantity is (\d*) and Factory9 quantity is (\d*) in pool/,
    undefined,
    30000
  )
  public async verifyTokenAQtyIncreasedAndTokenBQtyDecreased(
    tokenAQuantity: BigNumber,
    tokenBQuantity: BigNumber
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);

    const withPrecision = Common.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @when(/User update the slippage value to (\d*)/, undefined, 30000)
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

  @when(/User gives (\d*) units of HBAR to the pool/, undefined, 30000)
  public async calculateTokenAQtyForGivenTokenBQty(tokenHBARCount: number) {
    const tokenHBARQty = Common.withPrecision(tokenHBARCount, precision);
    tokenAQty = await pair.getInGivenOut(tokenHBARQty, client);
  }

  @then(/Expected quantity of Factory9 token should be (\d*)/, undefined, 30000)
  public async verifyTokenAQty(expectedTokenAQty: string) {
    const withPrecision = Common.withPrecision(1, precision);
    expect(Number(Number(tokenAQty.dividedBy(withPrecision)).toFixed())).to.eql(
      Number(expectedTokenAQty)
    );
  }

  @when(
    /User gives (\d*) units of Factory9 to calculate slippage out/,
    undefined,
    30000
  )
  public async calculateSlippageOut(tokenACount: number) {
    const tokenAQty = Common.withPrecision(tokenACount, precision);
    slippageOutGivenIn = await pair.slippageOutGivenIn(tokenAQty, client);
  }

  @then(/Slippage out value should be (\d*)/, undefined, 30000)
  public async verifySlippageOut(expectedSlippageOut: string) {
    expect(Number(slippageOutGivenIn)).to.eql(Number(expectedSlippageOut));
  }

  @when(
    /User gives (\d*) units of HBAR to calculate slippage in/,
    undefined,
    30000
  )
  public async calculateSlippageIn(tokenHBARCount: number) {
    const tokenBQty = Common.withPrecision(tokenHBARCount, precision);
    slippageInGivenOut = await pair.slippageInGivenOut(tokenBQty, client);
  }

  @then(/Slippage in value should be (\d*)/, undefined, 30000)
  public async verifySlippageIn(expectedSlippageIn: string) {
    expect(Number(slippageInGivenOut)).to.eql(Number(expectedSlippageIn));
  }

  @then(
    /User verifies balance of "([^"]*)" token from contract is (\d*)/,
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
    expect(Number(Number(tokenBalance / withPrecision).toFixed())).to.eql(
      Number(tokenQty)
    );
  }

  private async fetchContractID(pairAddress: string): Promise<ContractId> {
    await Helper.delay(15000);
    const response = await httpRequest(pairAddress, undefined);
    return response.contract_id;
  }
}
