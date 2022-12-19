import { ContractService } from "../../deployment/service/ContractService";
import { DeployedContract } from "../../deployment/model/contract";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import Pair from "../business/Pair";
import { expect } from "chai";
import { Test } from "mocha";
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
let lpTokenProxyId;
let contractProxyId;

describe("E2E tests - pair contract", function () {
  before(async function () {
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
  });

  it("Verify token balance before and after adding liquidity", async function () {
    const tokensBefore = await pair.pairCurrentPosition(
      contractProxyId,
      client
    );
    let precision = await pair.getPrecisionValue(contractProxyId, client);
    const tokenAQty = await pair.withPrecision(210, precision);
    console.log("value of tokenAQty", tokenAQty);
    const tokenBQty = await pair.withPrecision(230, precision);
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
    const tokensAfter = await pair.pairCurrentPosition(contractProxyId, client);
    expect(tokensAfter[0]).to.be.equal(
      BigNumber.sum(tokensBefore[0], tokenAQty)
    );
    expect(tokensAfter[1]).to.be.equal(
      BigNumber.sum(tokensBefore[1], tokenBQty)
    );
  });
});
