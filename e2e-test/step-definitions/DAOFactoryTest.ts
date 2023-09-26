import Common from "../business/Common";
import DAOFactory from "../business/factories/DAOFactory";
import FTDAOFactory from "../business/factories/FTDAOFactory";
import NFTDAOFactory from "../business/factories/NFTDAOFactory";
import FTTokenHolderFactory from "../business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../business/factories/NFTTokenHolderFactory";

import { expect } from "chai";
import { ethers } from "ethers";
import { clientsInfo } from "../../utils/ClientManagement";
import { CommonSteps, TokenInfo } from "./CommonSteps";
import { binding, given, then, when } from "cucumber-tsflow";

const DAO_INFO_URL = "https://linkedin.com";
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_ADMIN_ADDRESS: string = clientsInfo.operatorId.toSolidityAddress();

let daoFactory: DAOFactory;

let errorMessage: string;
let godTokenInfo: TokenInfo;

@binding()
export class DAOFactoryTest extends CommonSteps {
  @given(/User creates the DAOFactory for token-id "([^"]*)"/, undefined, 60000)
  public async setup(godTokenId: string) {
    console.log("---:Running DAOFactory:---");
    console.log("----------------------------------", "\n");
    godTokenInfo = await Common.getTokenInfo(godTokenId);
    console.table(godTokenInfo);
    await this.deployRequiredContracts();
  }

  @given(/User get initialized the contracts/, undefined, 300000)
  public async initContracts(): Promise<void> {
    await this._initContracts();
  }

  @when(/User create a DAO with name "([^"]*)"/, undefined, 90000)
  public async createDAO(daoName: string) {
    try {
      await daoFactory.createDAO(
        daoName,
        DAO_INFO_URL,
        DAO_INFO_URL,
        DAO_DESC,
        DAO_WEB_LINKS,
        godTokenInfo.address,
        CommonSteps.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
        CommonSteps.DEFAULT_VOTING_DELAY,
        CommonSteps.DEFAULT_VOTING_PERIOD,
        false,
        DAO_ADMIN_ADDRESS,
        DAO_ADMIN_CLIENT,
      );
    } catch (e: any) {
      console.error(` - DAOFactory#createDAO():`, e.message);
      errorMessage = e.message;
    }
  }

  @then(
    /User verify that created dao and its properties available/,
    undefined,
    50000,
  )
  public async verifyDAOAddressIsAvailable() {
    const daoAddress = (await daoFactory.getDAOs()).at(-1)!;
    expect(ethers.utils.isAddress(daoAddress)).equals(true);

    const dao = await daoFactory.getGovernorTokenDaoInstance(daoAddress);
    const governor = await dao.getGovernorAddress(DAO_ADMIN_CLIENT);
    const tokenId = (await governor.getGODTokenAddress()).toString();
    expect(tokenId).equals(godTokenInfo.id);
  }

  @then(/User gets the message "([^"]*)"/, undefined, 30000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMessage).includes(msg);
    errorMessage = "";
  }

  private async deployRequiredContracts() {
    const _contracts = [
      godTokenInfo.isNFT ? "NFTDAOFactory" : "FTDAOFactory",
      godTokenInfo.isNFT ? "NFTTokenHolderFactory" : "GODTokenHolderFactory",
    ];
    await this.deploy(_contracts.toString());
    return _contracts;
  }

  private async _initContracts() {
    const tokenHolderFactory = godTokenInfo.isNFT
      ? new NFTTokenHolderFactory()
      : new FTTokenHolderFactory();
    await tokenHolderFactory.initialize();

    daoFactory = godTokenInfo.isNFT ? new NFTDAOFactory() : new FTDAOFactory();
    await daoFactory.initialize(DAO_ADMIN_CLIENT, tokenHolderFactory);
  }
}
