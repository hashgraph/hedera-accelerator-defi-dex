import FTDAO from "../business/FTDAO";
import Common from "../business/Common";
import DAOFactory from "../business/factories/DAOFactory";
import FTDAOFactory from "../business/factories/FTDAOFactory";
import NFTDAOFactory from "../business/factories/NFTDAOFactory";
import HederaGovernor from "../business/HederaGovernor";
import TokenHolderFactory from "../business/factories/TokenHolderFactory";
import FTTokenHolderFactory from "../business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../business/factories/NFTTokenHolderFactory";

import { expect } from "chai";
import { ethers } from "ethers";
import { CommonSteps } from "./CommonSteps";
import { clientsInfo } from "../../utils/ClientManagement";
import { binding, given, then, when } from "cucumber-tsflow";

const DAO_INFO_URL = "https://linkedin.com";
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_ADMIN_ADDRESS: string = clientsInfo.operatorId.toSolidityAddress();

interface TokenInfo {
  id: string;
  address: string;
  name: string;
  isNFT: boolean;
  symbol: string;
  treasuryAccountId: string;
  decimals: number;
}

let godTokenInfo: TokenInfo;
let errorMessage: string;

let ftDao: FTDAO;
let daoAddress: string;
let daoFactory: DAOFactory;
let governor: HederaGovernor;
let tokenHolderFactory: TokenHolderFactory;

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
      daoAddress = (await daoFactory.getDAOs()).at(-1)!;
      ftDao = await daoFactory.getGovernorTokenDaoInstance(daoAddress);
      governor = await ftDao.getGovernorAddress(DAO_ADMIN_CLIENT);
    } catch (e: any) {
      console.error(` - DAOFactory#createDAO():`, e.message);
      errorMessage = e.message;
    }
  }

  @then(/User verify that created dao address is available/, undefined, 30000)
  public async verifyDAOAddressIsAvailable() {
    expect(ethers.utils.isAddress(daoAddress)).equals(true);
  }

  @then(/User validate created governance/, undefined, 30000)
  public async validateGovernor() {
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
    tokenHolderFactory = godTokenInfo.isNFT
      ? new NFTTokenHolderFactory()
      : new FTTokenHolderFactory();
    await tokenHolderFactory.initialize();

    daoFactory = godTokenInfo.isNFT ? new NFTDAOFactory() : new FTDAOFactory();
    await daoFactory.initialize(DAO_ADMIN_CLIENT, tokenHolderFactory);
  }
}
