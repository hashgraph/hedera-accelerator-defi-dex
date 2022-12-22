import { binding, given, then, when } from "cucumber-tsflow";
import { assert, expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import { DeployedContract } from "../../deployment/model/contract";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import Pair from "../business/Pair";
import { BigNumber } from "bignumber.js";

const clientManagement = new ClientManagement();
const contractService = new ContractService();
const lpTokenContract = contractService.getContractWithProxy(
  contractService.lpTokenContractName
);
const pairContract = contractService.getContractWithProxy(
  contractService.pairContractName
);
const { treasureId, treasureKey } = clientManagement.getTreasure();
const treasurerClient = clientManagement.createClient();
const { key } = clientManagement.getOperator();
const client = clientManagement.createOperatorClient();
const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;
const pair = new Pair();

let tokenA: TokenId;
let tokenB: TokenId;
let lpTokenProxyId: string;
let contractProxyId: string;
let tokensBefore: BigNumber[];
let tokensAfter: BigNumber[];

@binding()
export class PairTestSteps {
  @given(
    /User have created pair of tokens and intialized them/,
    undefined,
    30000
  )
  public async createTokenPairAndInitializeThem(): Promise<void> {
    const num = Math.floor(Math.random() * 10) + 1;
    tokenA = await pair.createToken(
      "A" + num,
      treasureKey,
      treasureId,
      treasurerClient,
      client
    );
    tokenB = await pair.createToken(
      "B" + num,
      treasureKey,
      treasureId,
      treasurerClient,
      client
    );
    console.log(`\nToken pair created using ${tokenA} and ${tokenB}`);
    lpTokenProxyId = await lpTokenContract.transparentProxyId!;
    contractProxyId = await pairContract.transparentProxyId!;
    await pair.initializeLPTokenContract(
      lpTokenProxyId,
      client,
      htsServiceAddress
    );
    await pair.initializePairContract(
      contractProxyId,
      lpTokenContract.transparentProxyAddress!,
      htsServiceAddress,
      tokenA,
      tokenB,
      treasureId,
      client,
      key
    );
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
    tokensBefore = await pair.pairCurrentPosition(contractProxyId, client);
    let precision = await pair.getPrecisionValue(contractProxyId, client);
    const tokenAQty = await pair.withPrecision(tokenACount, precision);
    const tokenBQty = await pair.withPrecision(tokenBCount, precision);
    await pair.addLiquidity(
      contractProxyId,
      tokenAQty,
      tokenBQty,
      treasureId,
      tokenA,
      tokenB,
      client,
      treasureKey
    );
  }

  @then(
    /Then  tokenA and tokenB balances in the pool are (\d*) units and (\d*) units respectively/,
    undefined,
    30000
  )
  public async verifyTokensInPool(
    tokenACount: number,
    tokenBCount: number
  ): Promise<void> {
    let precision = await pair.getPrecisionValue(contractProxyId, client);
    const tokenAQty = await pair.withPrecision(tokenACount, precision);
    const tokenBQty = await pair.withPrecision(tokenBCount, precision);
    tokensAfter = await pair.pairCurrentPosition(contractProxyId, client);
    expect(tokensAfter[0]).to.eql(BigNumber.sum(tokensBefore[0], tokenAQty));
    expect(tokensAfter[1]).to.eql(BigNumber.sum(tokensBefore[1], tokenBQty));
  }
}
