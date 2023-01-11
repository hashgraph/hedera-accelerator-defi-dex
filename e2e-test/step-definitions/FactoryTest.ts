import { binding, given, then, when } from "cucumber-tsflow";
import { expect } from "chai";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { TokenId } from "@hashgraph/sdk";
import Pair from "../business/Pair";
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
let pairCountBefore: string[];
let pairCountAfter: string[];

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
      treasureId,
      treasureKey,
      client
    );
  }

  @when(/User create tokens with same name/, undefined, 30000)
  public async createTokenWithSameName(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await pair.createToken(
      "FactoryTestSingleToken" + num,
      treasureKey,
      treasureId,
      treasurerClient,
      client
    );
    tokenTwo = await pair.createToken(
      "FactoryTestSingleToken" + num,
      treasureKey,
      treasureId,
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

  @when(/User create a new token/, undefined, 30000)
  public async createSingleToken(): Promise<void> {
    const num = Math.floor(Math.random() * 100) + 1;
    tokenOne = await pair.createToken(
      "FactoryTestSingleToken" + num,
      treasureKey,
      treasureId,
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
      await factory.createPair(
        contractId,
        tokenOne,
        tokenOne,
        treasureId,
        treasureKey,
        client
      );
    } catch (e: any) {
      expect(e.message).contains(msg);
    }
  }
}
