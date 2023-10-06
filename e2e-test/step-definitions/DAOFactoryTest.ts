import Common from "../business/Common";
import DAOFactory from "../business/factories/DAOFactory";
import FTDAOFactory from "../business/factories/FTDAOFactory";
import NFTDAOFactory from "../business/factories/NFTDAOFactory";
import FTTokenHolderFactory from "../business/factories/FTTokenHolderFactory";
import NFTTokenHolderFactory from "../business/factories/NFTTokenHolderFactory";

import { expect } from "chai";
import { ethers } from "ethers";
import { clientsInfo } from "../../utils/ClientManagement";
import { DAOConfigDetails } from "../business/types";
import { binding, then, when } from "cucumber-tsflow";
import { CommonSteps, TokenInfo } from "./CommonSteps";
import { Hbar, TokenId, HbarUnit } from "@hashgraph/sdk";

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_INFO_URL = "https://linkedin.com";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];

const DAO_CONFIG = {
  daoTreasurerId: clientsInfo.uiUserId,
  daoTreasurerPK: clientsInfo.uiUserKey,
  daoTreasurerClient: clientsInfo.uiUserClient,
  fromAccountId: clientsInfo.treasureId,
  fromAccountKey: clientsInfo.treasureKey,
  fromAccountClient: clientsInfo.treasureClient,
};

let daoFactory: DAOFactory;

let errorMessage: string;
let godTokenInfo: TokenInfo;
let daoFeeConfig: DAOConfigDetails;

@binding()
export class DAOFactoryTest extends CommonSteps {
  @when(/User creates the DAOFactory for token-id "([^"]*)"/, undefined, 60000)
  public async setup(godTokenId: string) {
    console.log("---:Running DAOFactory:---");
    console.log("----------------------------------", "\n");
    godTokenInfo = await Common.getTokenInfo(godTokenId);
    console.table(godTokenInfo);
    await this.deployRequiredContracts();
  }

  @then(
    /User setup dao creation fee for token-id "([^"]*)" with amount\/id "([^"]*)"/,
    undefined,
    60000,
  )
  public async setupDaoCreationFeeAndAllowance(
    feeTokenId: string,
    feeAmountOrId: string,
  ) {
    const daoFee = CommonSteps.normalizeAmountOrId(feeAmountOrId);
    const daoFeeTokenId = TokenId.fromString(feeTokenId);
    daoFeeConfig = {
      daoTreasurer: DAO_CONFIG.daoTreasurerId.toSolidityAddress(),
      tokenAddress: daoFeeTokenId.toSolidityAddress(),
      daoFee,
    };
    console.log(" - DAO fee config details:-");
    console.table({ daoFeeConfig });
  }

  @then(/User gets initialized contracts/, undefined, 300000)
  public async initContracts(): Promise<void> {
    await this._initContracts();
  }

  @when(/User create a DAO with name "([^"]*)"/, undefined, 90000)
  public async createDAO(daoName: string) {
    try {
      const feeInHBar =
        await this.setupDAOCreationAllowanceAndGetFeeAmount(daoFactory);

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
        feeInHBar,
        DAO_CONFIG.fromAccountId.toSolidityAddress(),
        DAO_CONFIG.fromAccountClient,
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
    const governor = await dao.getGovernorAddress(DAO_CONFIG.fromAccountClient);
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
    await daoFactory.initialize(
      DAO_CONFIG.fromAccountClient,
      tokenHolderFactory,
      daoFeeConfig,
    );
  }

  private async setupDAOCreationAllowanceAndGetFeeAmount(factory: DAOFactory) {
    const tokenId = TokenId.fromSolidityAddress(daoFeeConfig.tokenAddress);
    const feeAllowanceAmount = Common.isHBAR(tokenId)
      ? Hbar.from(daoFeeConfig.daoFee, HbarUnit.Tinybar)
          .to(HbarUnit.Hbar)
          .toNumber()
      : daoFeeConfig.daoFee;

    // 1- setup allowance
    await Common.setTokenAllowance(
      tokenId,
      daoFactory.contractId,
      feeAllowanceAmount,
      DAO_CONFIG.fromAccountId,
      DAO_CONFIG.fromAccountKey,
      DAO_CONFIG.fromAccountClient,
    );

    // 2- associate token to fee collector account
    await Common.associateTokensToAccount(
      DAO_CONFIG.daoTreasurerId,
      [tokenId],
      DAO_CONFIG.daoTreasurerClient,
      DAO_CONFIG.daoTreasurerPK,
    );

    return Common.isHBAR(tokenId) ? feeAllowanceAmount : 0;
  }
}
