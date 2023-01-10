import { binding, given, then, when } from "cucumber-tsflow";
import { assert, expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import { DeployedContract } from "../../deployment/model/contract";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import Pair from "../business/Pair";
import { BigNumber } from "bignumber.js";
import Factory from "../business/Factory";

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

const factory = new Factory();
const pair = new Pair();
let tokenOne: TokenId;
let tokenTwo: TokenId;
let expectedPairAddress: string;
let actualPairAddress: string;

@binding()
export class FactorySteps {
  @given(/User have setup the factory/, undefined, 30000)
  public async setUpFactory(): Promise<void> {
    await factory.setupFactory(baseContractAddress, contractId, client);
  }

  @when(/User create a new pair of tokens/, undefined, 30000)
  public async createNewPair(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await pair.createToken(
      "FactoryTestOne" + num,
      treasureKey,
      treasureId,
      treasurerClient,
      client
    );
    tokenTwo = await pair.createToken(
      "FactoryTestTwo" + num,
      treasureKey,
      treasureId,
      treasurerClient,
      client
    );
    actualPairAddress = await factory.createPair(
      contractId,
      tokenOne,
      tokenTwo,
      treasureId,
      treasureKey,
      client
    );
  }

  @then(
    /User verify address of pair of is same to address received after pair creation/,
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
}
