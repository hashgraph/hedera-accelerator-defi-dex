import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import Pair from "../business/Pair";
import Factory from "../business/Factory";
import { BigNumber } from "bignumber.js";
import { httpRequest } from "../../deployment/api/HttpsService";
import { Helper } from "../../utils/Helper";

const clientManagement = new ClientManagement();
const client = clientManagement.createOperatorClient();
const { treasureId, treasureKey } = clientManagement.getTreasure();
const contractService = new ContractService();
const treasurerClient = clientManagement.createClient();
const baseContract = contractService.getContract(
  contractService.baseContractName
);
const contractId = contractService.getContractWithProxy(
  contractService.factoryContractName
).transparentProxyId!;
const baseContractAddress = baseContract.address;
const { id, key } = clientManagement.getOperator();

const factory = new Factory();
const pair = new Pair();
let tokenOne: TokenId;
let tokenTwo: TokenId;
let expectedPairAddress: string;
let actualPairAddress: string;
let pairCountBefore: string[];
let pairCountAfter: string[];
let tokenHBARX = TokenId.fromString("0.0.49217385");
let tokenAHBARPairAddress: string;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];
let lpTokensInPool: Long;
let pairContractId: string;
let lpTokenContractId: string;
let lpTokenQty: BigNumber;
let tokenAQty: BigNumber;
let slippageOutGivenIn: BigNumber;
let slippageInGivenOut: BigNumber;

@binding()
export class FactorySteps {
  @given(/User have setup the factory/, undefined, 30000)
  public async setUpFactory(): Promise<void> {
    console.log(
      "*******************Starting factory test with following credentials*******************"
    );
    console.log("contractId : ", contractId);
    console.log("baseContractAddress : ", baseContractAddress);
    console.log("TOKEN_USER_ID : ", id);
    console.log("treasureId :", treasureId);
    await factory.setupFactory(baseContractAddress, contractId, client);
  }

  @when(/User create a new pair of tokens/, undefined, 60000)
  public async createNewPair(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await pair.createToken(
      "FactoryTestOne" + num,
      key,
      id,
      treasurerClient,
      client
    );
    tokenTwo = await pair.createToken(
      "FactoryTestTwo" + num,
      key,
      id,
      treasurerClient,
      client
    );
    actualPairAddress = await factory.createPair(
      contractId,
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
    expectedPairAddress = await factory.getPair(
      contractId,
      tokenOne,
      tokenTwo,
      client
    );
    expect(actualPairAddress).to.eql(expectedPairAddress);
  }

  @when(/User get all pairs of tokens/, undefined, 30000)
  public async getAllPairs(): Promise<void> {
    pairCountBefore = await factory.getAllPairs(contractId, client);
  }

  @then(/User verifies count of pairs is increased by 1/, undefined, 30000)
  public async verifyPairCount(): Promise<void> {
    pairCountAfter = await factory.getAllPairs(contractId, client);
    expect(pairCountAfter.length).to.eql(pairCountBefore.length + 1);
  }

  @when(/User create a new pair with same tokens/, undefined, 30000)
  public async createPairWithSameTokens(): Promise<void> {
    actualPairAddress = await factory.createPair(
      contractId,
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
    tokenOne = await pair.createToken(
      "FactoryTestSingleToken" + num,
      key,
      id,
      treasurerClient,
      client
    );
    tokenTwo = await pair.createToken(
      "FactoryTestSingleToken" + num,
      key,
      id,
      treasurerClient,
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
    tokenOne = await pair.createToken(
      "FactoryTestSingleToken" + num,
      key,
      id,
      treasurerClient,
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
      await factory.createPair(contractId, tokenOne, tokenOne, id, key, client);
    } catch (e: any) {
      expect(e.message).contains(msg);
    }
  }

  @when(/User create pair of tokenA and HBAR/, undefined, 30000)
  public async createPairOfTokenAWithHBAR(): Promise<void> {
    tokenAHBARPairAddress = await factory.createPair(
      contractId,
      tokenOne,
      tokenHBARX,
      treasureId,
      key,
      client
    );

    const pairAddress = await factory.getPair(
      contractId,
      tokenOne,
      tokenHBARX,
      client
    );
    await Helper.delay(15000);
    const response = await httpRequest(pairAddress, undefined);
    pairContractId = await response.contract_id;
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
    tokensBefore = await pair.pairCurrentPosition(pairContractId, client);
    let precision = await pair.getPrecisionValue(pairContractId, client);
    const tokenAQty = await pair.withPrecision(tokenACount, precision);
    const tokenBQty = await pair.withPrecision(tokenBCount, precision);
    await pair.addLiquidity(
      pairContractId,
      tokenAQty,
      tokenBQty,
      id,
      tokenOne,
      tokenHBARX,
      client,
      key,
      tokenBCount
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
    let precision = await pair.getPrecisionValue(pairContractId, client);
    const tokenAQty = await pair.withPrecision(tokenACount, precision);
    const tokenBQty = await pair.withPrecision(tokenBCount, precision);
    tokensAfter = await pair.pairCurrentPosition(pairContractId, client);
    expect(tokensAfter[0]).to.eql(BigNumber.sum(tokensBefore[0], tokenAQty));
    expect(tokensAfter[1]).to.eql(BigNumber.sum(tokensBefore[1], tokenBQty));
  }

  @given(/User fetches the count of lptokens from pool/, undefined, 30000)
  public async getLPTokensFromPool(): Promise<void> {
    let lpTokenContractAddress = await factory.getTokenPairAddress(
      pairContractId,
      client,
      treasureKey
    );
    let lpTokenId = TokenId.fromSolidityAddress(lpTokenContractAddress);
    lpTokensInPool = await factory.getTokenBalance(lpTokenId, id, client);
  }

  @when(/User gives (\d*) units of lptoken to pool/, undefined, 30000)
  public async returnLPTokensAndRemoveLiquidity(
    lpTokenCount: number
  ): Promise<void> {
    tokensBefore = await pair.pairCurrentPosition(pairContractId, client);
    let precision = await pair.getPrecisionValue(pairContractId, client);
    lpTokenQty = await pair.withPrecision(lpTokenCount, precision);
    await pair.removeLiquidity(pairContractId, lpTokenQty, id, client, key);
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
    tokensAfter = await pair.pairCurrentPosition(pairContractId, client);
    let precision = await pair.getPrecisionValue(pairContractId, client);
    let withPrecision = pair.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @given(/tokenA and HBAR are present in pool/, undefined, 30000)
  public async tokensArePresent(): Promise<void> {
    let tokensQty = await pair.pairCurrentPosition(pairContractId, client);
    expect(Number(tokensQty[0])).to.greaterThan(0);
    expect(Number(tokensQty[1])).to.greaterThan(0);
  }

  @when(/User make swap of (\d*) unit of tokenA with HBAR/, undefined, 30000)
  public async swapTokenA(tokenACount: number): Promise<void> {
    let precision = await pair.getPrecisionValue(pairContractId, client);
    const tokenAQty = await pair.withPrecision(tokenACount, precision);
    tokensBefore = await pair.pairCurrentPosition(pairContractId, client);
    await pair.swapTokenA(
      pairContractId,
      tokenAQty,
      id,
      tokenOne,
      client,
      treasureKey,
      key
    );
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
    tokensAfter = await pair.pairCurrentPosition(pairContractId, client);
    let precision = await pair.getPrecisionValue(pairContractId, client);
    let withPrecision = pair.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @when(/User update the slippage value to (\d*)/, undefined, 30000)
  public async setSlippageVal(slippage: number): Promise<void> {
    let precision = await pair.getPrecisionValue(pairContractId, client);
    let slippageWithPrecision = pair.withPrecision(slippage, precision);
    pair.setSlippage(pairContractId, client, slippageWithPrecision);
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
      await factory.createPair(
        contractId,
        tokenHBARX,
        tokenHBARX,
        id,
        key,
        client
      );
    } catch (e: any) {
      expect(e.message).contains(msg);
    }
  }

  @when(/User gives (\d*) units of HBAR to the pool/, undefined, 30000)
  public async calculateTokenAQtyForGivenTokenBQty(tokenHBARCount: number) {
    let precision = await pair.getPrecisionValue(pairContractId, client);
    const tokenHBARQty = await pair.withPrecision(tokenHBARCount, precision);
    tokenAQty = await pair.getInGivenOut(pairContractId, tokenHBARQty, client);
  }

  @then(/Expected quantity of tokenA should be (\d*)/, undefined, 30000)
  public async verifyTokenAQty(expectedTokenAQty: string) {
    let precision = await pair.getPrecisionValue(pairContractId, client);
    let withPrecision = pair.withPrecision(1, precision);
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
    let precision = await pair.getPrecisionValue(pairContractId, client);
    const tokenAQty = await pair.withPrecision(tokenACount, precision);
    slippageOutGivenIn = await pair.slippageOutGivenIn(
      pairContractId,
      tokenAQty,
      client
    );
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
    let precision = await pair.getPrecisionValue(pairContractId, client);
    const tokenBQty = await pair.withPrecision(tokenHBARCount, precision);
    slippageInGivenOut = await pair.slippageInGivenOut(
      pairContractId,
      tokenBQty,
      client
    );
  }

  @then(/Slippage in value should be (\d*)/, undefined, 30000)
  public async verifySlippageIn(expectedSlippageIn: string) {
    expect(Number(slippageInGivenOut)).to.eql(Number(expectedSlippageIn));
  }
}
