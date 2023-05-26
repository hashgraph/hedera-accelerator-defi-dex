import dex from "../../deployment/model/dex";
import Governor from "../business/Governor";
import Common from "../business/Common";
import GodHolder from "../business/GodHolder";
import Factory from "../business/Factory";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { clientsInfo } from "../../utils/ClientManagement";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import { TokenId, AccountId, ContractId, Client } from "@hashgraph/sdk";
import { httpRequest } from "../../deployment/api/HttpsService";
import { Helper } from "../../utils/Helper";
import Pair from "../business/Pair";
import BigNumber from "bignumber.js";
import HederaService from "../business/HederaService";
import { CommonSteps } from "./CommonSteps";

const csDev = new ContractService();
const factoryContractId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

const tokenCreateContractId = csDev.getContractWithProxy(
  csDev.governorContractName
).transparentProxyId!;

const godHolderContractId = csDev.getContractWithProxy(csDev.godHolderContract)
  .transparentProxyId!;

const factory = new Factory(factoryContractId);
const governor = new Governor(tokenCreateContractId);
const godHolder = new GodHolder(godHolderContractId);
const hederaService = new HederaService(
  csDev.getContract(csDev.hederaServiceContractName).id
);
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

let proposalId: string;
var tokenIDNameMap = new Map();
let pairAddress: string;
let pairContractId: any;
let pair: any;
let precision: BigNumber;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];
let pairAdd: any;

@binding()
export class GovernorCreateToken extends CommonSteps {
  @given(
    /User have initialized the governor token create contract/,
    undefined,
    30000
  )
  public async initialize() {
    console.log(
      "*******************Starting governor token create test with following credentials*******************"
    );
    console.log("governorContractId :", tokenCreateContractId);
    console.log("godHolderContractId :", godHolderContractId);
    console.log("factoryContractId :", factoryContractId);
    console.log("treasureId :", clientsInfo.treasureId.toString());
    console.log("operatorId :", clientsInfo.operatorId.toString());
    await this.initializeGovernorContract(
      governor,
      godHolder,
      clientsInfo.operatorClient,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      TokenId.fromString(dex.GOD_TOKEN_ID)
    );
  }

  @when(
    /User create a proposal with title "([^"]*)" to create a new token with name "([^"]*)" and symbol "([^"]*)"/,
    undefined,
    30000
  )
  public async createNewTokenProposal(
    proposalTitle: string,
    tokenName: string,
    tokenSymbol: string
  ) {
    try {
      proposalId = await governor.createTokenProposal(
        proposalTitle,
        tokenName,
        tokenSymbol,
        clientsInfo.operatorId
      );
    } catch (e: any) {
      await godHolder.checkAndClaimGodTokens(clientsInfo.operatorClient);
      throw e;
    }
  }

  @when(
    /User wait for create token proposal state to be "([^"]*)" for max (\d*) seconds/,
    undefined,
    30000
  )
  public async waitForState(state: string, seconds: number) {
    await this.waitForProposalState(governor, state, proposalId, seconds);
  }

  @when(
    /User cancel the create token proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async cancelProposal(title: string) {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }

  @then(
    /User verify create token proposal state is "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyProposalState(proposalState: string): Promise<void> {
    const { currentState, proposalStateNumeric } = await this.getProposalState(
      governor,
      proposalId,
      clientsInfo.operatorClient,
      proposalState
    );
    expect(Number(currentState)).to.eql(proposalStateNumeric);
  }

  @when(/User vote "([^"]*)" create token proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    await this.vote(governor, vote, proposalId, clientsInfo.operatorClient);
  }

  @when(
    /User execute the create token proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async execute(title: string) {
    await this.executeProposal(
      governor,
      title,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @then(
    /User verify that token is created with name "([^"]*)" and symbol "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyTokenIsCreated(tokenName: string, tokenSymbol: string) {
    const createdToken = await governor.getTokenAddressFromGovernorTokenCreate(
      proposalId
    );
    tokenIDNameMap.set(tokenName, createdToken);
    const tokenInfo = await Common.getTokenInfo(createdToken);
    expect(tokenInfo.name).to.eql(tokenName);
    expect(tokenInfo.symbol).to.eql(tokenSymbol);
  }

  @then(
    /User verify that token is not created and user receives "([^"]*)" message/,
    undefined,
    30000
  )
  public async verifyTokenIsNotCreated(msg: string) {
    try {
      await governor.getTokenAddressFromGovernorTokenCreate(proposalId);
    } catch (e: any) {
      expect(e.message).contains(msg);
    }
  }

  @when(/User delete the token with name "([^"]*)"/, undefined, 30000)
  public async deleteToken(tokenName: string) {
    const tokenId = tokenIDNameMap.get(tokenName);
    await Common.deleteToken(
      tokenId,
      clientsInfo.operatorClient,
      clientsInfo.operatorKey
    );
    tokenIDNameMap.delete(tokenName);
  }

  @when(/User create pair with token "([^"]*)" and "([^"]*)"/, undefined, 30000)
  public async createPair(firstTokenName: string, secondTokenName: string) {
    const firstTokenId = this.getTokenId(firstTokenName);
    const secondTokenId = this.getTokenId(secondTokenName);
    await hederaService.associateTokenPublic(
      firstTokenId,
      clientsInfo.operatorId,
      clientsInfo.operatorKey
    );
    pairAddress = await factory.createPair(
      firstTokenId,
      secondTokenId,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @given(/User setup the factory contract/, undefined, 30000)
  public async setupFactory() {
    await factory.setupFactory();
  }

  @then(
    /User verify that pair exists for token "([^"]*)" and "([^"]*)"/,
    undefined,
    30000
  )
  public async verifyPair(firstTokenName: string, secondTokenName: string) {
    const firstTokenId = await this.getTokenId(firstTokenName);
    const secondTokenId = await this.getTokenId(secondTokenName);
    const pairAdd = await factory.getPair(firstTokenId, secondTokenId);
    expect(pairAdd).to.eql(pairAddress);
    await Helper.delay(15000);
    const response = await httpRequest(pairAdd, undefined);
    pairContractId = response.contract_id;
    pair = new Pair(pairContractId);
  }

  private getTokenId(tokenName: string): TokenId {
    const tokenId =
      tokenName == "HBAR" ? tokenHBARX : tokenIDNameMap.get(tokenName);
    return tokenId;
  }

  @when(
    /User gives (\d*) units of "([^"]*)" and (\d*) units of "([^"]*)" token in to the pool/,
    undefined,
    30000
  )
  public async addTokensToPool(
    tokenACount: number,
    firstTokenName: string,
    tokenBCount: number,
    secondTokenName: string
  ) {
    const tokenOne = tokenIDNameMap.get(firstTokenName);
    const tokensBeforeFetched = await pair.getPairQty(
      clientsInfo.operatorClient
    );
    pairAdd = await pair.getTokenPairAddress();
    tokensBefore =
      pairAdd.tokenAAddress == tokenOne.toSolidityAddress()
        ? tokensBeforeFetched
        : tokensBeforeFetched.reverse();

    await pair.addLiquidity(
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      tokenOne,
      tokenACount,
      tokenHBARX,
      tokenBCount,
      precision,
      clientsInfo.operatorClient
    );
  }

  @when(/User associate the LPToken with account/, undefined, 30000)
  public async associateLPToken() {
    pairAdd = await pair.getTokenPairAddress();
    await Common.associateTokensToAccount(
      clientsInfo.operatorId,
      [TokenId.fromSolidityAddress(pairAdd.lpTokenAddress)],
      clientsInfo.operatorClient,
      clientsInfo.operatorKey
    );
  }
  @then(
    /User verify "([^"]*)" and "([^"]*)" balances in the pool are (\d*) units and (\d*) units respectively/,
    undefined,
    30000
  )
  public async verifyTokensInPool(
    firstTokenName: string,
    secondTokenName: string,
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    const tokenAQty = Common.withPrecision(tokenACount, precision);
    const tokenBQty = Common.withPrecision(tokenBCount, precision);
    tokensAfter = await pair.getPairQty(clientsInfo.operatorClient);

    expect(tokensAfter[1]).to.eql(BigNumber.sum(tokensBefore[0], tokenAQty));
    expect(tokensAfter[0]).to.eql(BigNumber.sum(tokensBefore[1], tokenBQty));
  }

  @when(/User sets the slippage value to (\d*)/, undefined, 30000)
  public async setSlippageVal(slippage: number): Promise<void> {
    const slippageWithPrecision = Common.withPrecision(slippage, precision);
    pair.setSlippage(slippageWithPrecision, clientsInfo.operatorClient);
  }

  @when(
    /User swaps (\d*) unit of "([^"]*)" token with another token in pair with slippage as (\d+\.?\d*)/,
    undefined,
    30000
  )
  public async swapToken(
    tokenCount: number,
    tokenName: string,
    slippage: number
  ): Promise<void> {
    tokensBefore = await pair.getPairQty(clientsInfo.operatorClient);
    const tokenToSwap = tokenIDNameMap.get(tokenName);
    const slippageVal = new BigNumber(slippage).multipliedBy(
      precision.div(100)
    );
    await pair.swapToken(
      tokenToSwap,
      tokenCount,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      precision,
      slippageVal,
      clientsInfo.treasureClient
    );
  }

  @when(/User mints (\d*) units of "([^"]*)"/, undefined, 30000)
  public async mintToken(units: number, tokenName: string) {
    precision = await pair.getPrecisionValue(clientsInfo.operatorClient);
    const tokenQty = Common.withPrecision(units, precision);
    await governor.mintToken(proposalId, tokenQty, clientsInfo.operatorClient);
  }

  @when(
    /User transfer (\d*) units of Token-1 to user account/,
    undefined,
    30000
  )
  public async TransferToken(units: number) {
    await governor.transferToken(
      proposalId,
      clientsInfo.operatorId.toSolidityAddress(),
      new BigNumber(units * CommonSteps.withPrecision),
      clientsInfo.operatorClient
    );
  }

  @when(
    /User verify "([^"]*)" and "([^"]*)" quantity in pool is (\d*) units and (\d*) units/,
    undefined,
    30000
  )
  public async verifyTokenAQtyIncreasedAndTokenBQtyDecreased(
    firstTokenName: string,
    secondTokenName: string,
    tokenAQuantity: BigNumber,
    tokenBQuantity: BigNumber
  ): Promise<void> {
    tokensAfter = await pair.getPairQty(clientsInfo.operatorClient);

    const withPrecision = Common.withPrecision(1, precision);
    expect(
      Number(Number(tokensAfter[1].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenAQuantity));
    expect(
      Number(Number(tokensAfter[0].dividedBy(withPrecision)).toFixed())
    ).to.eql(Number(tokenBQuantity));
  }

  @when(
    /User lock (\d+\.?\d*) GOD token before voting to create token proposal/,
    undefined,
    30000
  )
  public async lockGOD(tokenAmt: number) {
    await this.lockTokens(
      godHolder,
      tokenAmt * CommonSteps.withPrecision,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(/User fetch GOD tokens back from GOD holder/, undefined, 30000)
  public async revertGOD() {
    await this.revertTokens(
      ContractId.fromString(godHolderContractId),
      clientsInfo.operatorId,
      AccountId.fromString(godHolderContractId),
      clientsInfo.operatorKey,
      TokenId.fromString(dex.GOD_TOKEN_ID),
      clientsInfo.operatorClient
    );
  }

  @when(
    /User setup (\d+\.?\d*) as allowance amount for token locking for token create proposal/,
    undefined,
    30000
  )
  public async setAllowanceForTokenLocking(allowanceAmt: number) {
    await this.setupAllowanceForTokenLocking(
      godHolder,
      allowanceAmt * CommonSteps.withPrecision,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(
    /User set default allowance for token create proposal/,
    undefined,
    30000
  )
  public async setAllowanceForProposalCreation() {
    await this.setupAllowanceForProposalCreation(
      governor,
      clientsInfo.operatorClient,
      clientsInfo.operatorId,
      clientsInfo.operatorKey
    );
  }

  @when(
    /User sets (\d+\.?\d*) as allowance amount for token "([^"]*)"/,
    undefined,
    30000
  )
  public async setAllowanceForToken(allowanceAmt: number, tokenName: string) {
    const tokenId = this.getTokenId(tokenName);
    await Common.setTokenAllowance(
      tokenId,
      pairContractId,
      allowanceAmt * CommonSteps.withPrecision,
      clientsInfo.operatorId,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
  }

  @when(/User associate "([^"]*)" token to account/)
  public async associateToken(tokenName: string) {
    const tokenId = this.getTokenId(tokenName);
    await Common.associateTokensToAccount(
      clientsInfo.operatorId,
      [tokenId],
      clientsInfo.operatorClient,
      clientsInfo.operatorKey
    );
  }
}
