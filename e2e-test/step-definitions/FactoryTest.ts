import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import dex from "../../deployment/model/dex";
import Pair from "../business/Pair";
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
let tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);
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
    console.log("TOKEN_USER_ID : ", id);
    console.log("TREASURE_ID :", treasureId);
    try {
      await factory.setupFactory(baseContractAddress, adminAddress, client);
    } catch (error) {}
  }

  @when(/User create a new pair of tokens/, undefined, 60000)
  public async createNewPair(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await factory.createToken(
      "FactoryTestOne" + num,
      "FactoryTestOne" + num,
      id,
      key,
      client
    );
    tokenTwo = await factory.createToken(
      "FactoryTestTwo" + num,
      "FactoryTestTwo" + num,
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
  }

  @then(
    /User verify address of pair is same to address received after pair creation/,
    undefined,
    30000
  )
  public async getPair(): Promise<void> {
    expectedPairAddress = await factory.getPair(tokenOne, tokenTwo, client);
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

  @when(/User create tokens with same name/, undefined, 30000)
  public async createTokenWithSameName(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await factory.createToken(
      "FactoryTestSingleToken" + num,
      "FactoryTestSingleToken" + num,
      id,
      key,
      client
    );
    tokenTwo = await factory.createToken(
      "FactoryTestSingleToken" + num,
      "FactoryTestSingleToken" + num,
      id,
      key,
      client
    );
  }

  @then(/User verifies their address are different/, undefined, 30000)
  public async verifyAddressOfPairWithSameToken(): Promise<void> {
    expect(tokenOne.toSolidityAddress()).not.to.eql(
      tokenTwo.toSolidityAddress()
    );
  }

  @when(/User create a new token/, undefined, 60000)
  public async createSingleToken(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await factory.createToken(
      "FactoryTestSingleToken" + num,
      "FactoryTestSingleToken" + num,
      id,
      key,
      client
    );
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

  @when(/User create pair of tokenA and HBAR/, undefined, 30000)
  public async createPairOfTokenAWithHBAR(): Promise<void> {
    tokenAHBARPairAddress = await factory.createPair(
      tokenOne,
      tokenHBARX,
      treasureId,
      treasureKey,
      client
    );

    const pairAddress = await factory.getPair(tokenOne, tokenHBARX, client);
    await Helper.delay(15000);
    const response = await httpRequest(pairAddress, undefined);
    pair = new Pair(response.contract_id);
    precision = await pair.getPrecisionValue(client);
  }

  @when(
    /User adds (\d*) units of first token and (\d*) units of HBAR token/,
    undefined,
    30000
  )
  public async addLiquidityInPool(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);

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
    /first token and HBAR balances in the pool are (\d*) units and (\d*) units respectively/,
    undefined,
    30000
  )
  public async verifyTokensInPool(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    const tokenAQty = pair.withPrecision(tokenACount, precision);
    const tokenBQty = pair.withPrecision(tokenBCount, precision);
    tokensAfter = await pair.getPairQty(client);
    expect(tokensAfter[0]).to.eql(BigNumber.sum(tokensBefore[0], tokenAQty));
    expect(tokensAfter[1]).to.eql(BigNumber.sum(tokensBefore[1], tokenBQty));
  }

  @given(/User fetches the count of lptokens from pool/, undefined, 30000)
  public async getLPTokensFromPool(): Promise<void> {
    const { lpTokenAddress } = await pair.getTokenPairAddress(client);
    const lpTokenId = TokenId.fromSolidityAddress(lpTokenAddress);
    lpTokensInPool = await factory.getTokenBalance(id, lpTokenId, client);
  }

  @when(/User gives (\d*) units of lptoken to pool/, undefined, 30000)
  public async returnLPTokensAndRemoveLiquidity(
    lpTokenCount: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(client);

    lpTokenQty = pair.withPrecision(lpTokenCount, precision);
    await pair.removeLiquidity(lpTokenQty, id, key, client);
  }

  @then(
    /User verifies (\d*) units of tokenA and (\d*) units of HBAR are left in pool/,
    undefined,
    30000
  )
  public async verifyTokensLeftInPoolAfterRemovingLiquidity(
    tokenAQuantity: Number,
    tokenBQuantity: Number
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);

    const withPrecision = pair.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @given(/tokenA and HBAR are present in pool/, undefined, 30000)
  public async tokensArePresent(): Promise<void> {
    const tokensQty = await pair.getPairQty(client);
    expect(Number(tokensQty[0])).to.greaterThan(0);
    expect(Number(tokensQty[1])).to.greaterThan(0);
  }

  @when(/User make swap of (\d*) unit of tokenA with HBAR/, undefined, 30000)
  public async swapTokenA(tokenACount: number): Promise<void> {
    tokensBefore = await pair.getPairQty(client);
    await pair.swapToken(tokenOne, tokenACount, id, key, precision, client);
  }

  @then(
    /tokenA quantity is (\d*) and HBAR quantity is (\d*) in pool/,
    undefined,
    30000
  )
  public async verifyTokenAQtyIncreasedAndTokenBQtyDecreased(
    tokenAQuantity: BigNumber,
    tokenBQuantity: BigNumber
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(client);

    const withPrecision = pair.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @when(/User update the slippage value to (\d*)/, undefined, 30000)
  public async setSlippageVal(slippage: number): Promise<void> {
    const slippageWithPrecision = pair.withPrecision(slippage, precision);
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
    const tokenHBARQty = pair.withPrecision(tokenHBARCount, precision);
    tokenAQty = await pair.getInGivenOut(tokenHBARQty, client);
  }

  @then(/Expected quantity of tokenA should be (\d*)/, undefined, 30000)
  public async verifyTokenAQty(expectedTokenAQty: string) {
    const withPrecision = pair.withPrecision(1, precision);
    expect(Number(Number(tokenAQty.dividedBy(withPrecision)).toFixed())).to.eql(
      Number(expectedTokenAQty)
    );
  }

  @when(
    /User gives (\d*) units of tokenA to calculate slippage out/,
    undefined,
    30000
  )
  public async calculateSlippageOut(tokenACount: number) {
    const tokenAQty = pair.withPrecision(tokenACount, precision);
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
    const tokenBQty = pair.withPrecision(tokenHBARCount, precision);
    slippageInGivenOut = await pair.slippageInGivenOut(tokenBQty, client);
  }

  @then(/Slippage in value should be (\d*)/, undefined, 30000)
  public async verifySlippageIn(expectedSlippageIn: string) {
    expect(Number(slippageInGivenOut)).to.eql(Number(expectedSlippageIn));
  }
}
