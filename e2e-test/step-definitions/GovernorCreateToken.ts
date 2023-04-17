import dex from "../../deployment/model/dex";
import Governor from "../business/Governor";
import Common from "../business/Common";
import GodHolder from "../business/GodHolder";
import Factory from "../business/Factory";
import { given, binding, when, then } from "cucumber-tsflow/dist";
import { clientsInfo } from "../../utils/ClientManagement";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import { TokenId } from "@hashgraph/sdk";
import { httpRequest } from "../../deployment/api/HttpsService";
import { Helper } from "../../utils/Helper";
import Pair from "../business/Pair";
import BigNumber from "bignumber.js";
import BaseHTS from "../business/BaseHTS";
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
const baseHTS = new BaseHTS(csDev.getContract(csDev.baseContractName).id);

const DEFAULT_QUORUM_THRESHOLD_IN_BSP = 1;
const DEFAULT_VOTING_DELAY = 2;
const DEFAULT_VOTING_PERIOD = 4;
const tokenHBARX = TokenId.fromString(dex.HBARX_TOKEN_ID);

let proposalId: string;
var tokenIDNameMap = new Map();
let pairAddress: string;
let pairContractId: any;
let pair: any;
let precision: BigNumber;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];

@binding()
export class GovernorCreateToken extends CommonSteps {
  @given(
    /User have initialized the governor token create contract/,
    undefined,
    30000
  )
  public async initialize() {
    console.log(
      "*******************Starting governor contract upgrade test with following credentials*******************"
    );
    console.log("governorContractId :", tokenCreateContractId);
    console.log("godHolderContractId :", godHolderContractId);
    console.log("factoryContractId :", factoryContractId);
    console.log("treasureId :", clientsInfo.treasureId.toString());
    console.log("operatorId :", clientsInfo.operatorId.toString());
    await governor.initialize(
      godHolder,
      clientsInfo.operatorClient,
      DEFAULT_QUORUM_THRESHOLD_IN_BSP,
      DEFAULT_VOTING_DELAY,
      DEFAULT_VOTING_PERIOD
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
        clientsInfo.operatorId,
        clientsInfo.operatorKey.publicKey,
        clientsInfo.operatorId,
        clientsInfo.operatorKey.publicKey
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
  public async waitForProposalState(state: string, seconds: number) {
    let revertRequired: boolean = false;
    if (state === "Executed") {
      revertRequired = true;
    }
    const requiredState = await governor.getProposalNumericState(state);
    try {
      await governor.getStateWithTimeout(
        proposalId,
        requiredState,
        seconds * 1000,
        1000
      );

      if (revertRequired) {
        console.log(
          `State of proposal is - ${state} revert of god token required is- ${revertRequired}`
        );
        await godHolder.checkAndClaimGodTokens(clientsInfo.operatorClient);
      }
    } catch (e: any) {
      console.log("Something went wrong while getting the state with timeout ");
      console.log(e);
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
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
    try {
      const currentState = await governor.state(
        proposalId,
        clientsInfo.operatorClient
      );
      const proposalStateNumeric = await governor.getProposalNumericState(
        proposalState
      );
      expect(Number(currentState)).to.eql(proposalStateNumeric);
    } catch (e: any) {
      console.log("Something went wrong while verifying the state of proposal");
      console.log(e);
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(/User vote "([^"]*)" create token proposal/, undefined, 30000)
  public async voteToProposal(vote: string): Promise<void> {
    try {
      const voteVal = await governor.getProposalVoteNumeric(vote);
      await governor.vote(proposalId, voteVal, clientsInfo.operatorClient);
    } catch (e: any) {
      console.log(
        "Something went wrong while voting to proposal now cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
  }

  @when(
    /User execute the create token proposal with title "([^"]*)"/,
    undefined,
    30000
  )
  public async executeProposal(title: string) {
    try {
      await governor.executeProposal(
        title,
        clientsInfo.operatorKey,
        clientsInfo.operatorClient
      );
    } catch (e: any) {
      console.log(
        "Something went wrong while executing proposal cancelling the proposal"
      );
      console.log(e);
      await this.cancelProposalInternally(
        governor,
        proposalId,
        clientsInfo.operatorClient,
        godHolder
      );
      throw e;
    }
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
    await baseHTS.associateTokenPublic(
      firstTokenId,
      clientsInfo.treasureId,
      clientsInfo.treasureKey
    );
    pairAddress = await factory.createPair(
      firstTokenId,
      secondTokenId,
      clientsInfo.treasureId,
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
    const pairAdd = await pair.getTokenPairAddress();
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
    const tokenId = tokenIDNameMap.get(tokenName);
    const tokenQty = Common.withPrecision(units, precision);
    await Common.mintToken(tokenId, Number(tokenQty));
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
    /User revert the god tokens for create token contract/,
    undefined,
    30000
  )
  public async revertGODToken() {
    await this.revertGODTokensFromGodHolder(
      godHolder,
      clientsInfo.operatorClient
    );
  }
}
