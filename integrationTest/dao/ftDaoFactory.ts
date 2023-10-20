import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import DAOFactory from "../../e2e-test/business/factories/DAOFactory";
import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import * as GovernanceProps from "../governance/governance";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { DEFAULT_FEE_CONFIG } from "../../e2e-test/business/constants";

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_ADMIN = clientsInfo.uiUserId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.uiUserClient;
const DAO_LOGO_URL = "https://defi-ui.zilbo.com/";
const DAO_TOKEN_ID = dex.GOVERNANCE_DAO_TWO_TOKEN_ID;
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_INFO_URL = "https://daoinfo.com";

const DEFAULT_DAO_CREATION_FEE_CONFIG = {
  ...DEFAULT_FEE_CONFIG,
  fromAccountId: clientsInfo.operatorId,
  fromAccountPK: clientsInfo.operatorKey,
  fromAccountClient: clientsInfo.operatorClient,
};

async function main() {
  await createNewCopies(); // only for dev testing
  const tokenHolderFactory = new FTTokenHolderFactory();
  await tokenHolderFactory.initialize();

  const daoFactory = new FTDAOFactory();
  await daoFactory.initialize(clientsInfo.operatorClient, tokenHolderFactory);

  const feeAmount = await setupDAOCreationAllowanceAndGetFeeAmount(daoFactory);
  await daoFactory.createDAO(
    dex.GOVERNANCE_DAO_TWO,
    DAO_LOGO_URL,
    DAO_INFO_URL,
    DAO_DESC,
    DAO_WEB_LINKS,
    DAO_TOKEN_ID.toSolidityAddress(),
    1,
    0,
    15,
    false,
    feeAmount,
    DAO_ADMIN,
    DEFAULT_DAO_CREATION_FEE_CONFIG.fromAccountClient,
  );

  const daoAddresses = await daoFactory.getDAOs();
  const daoAddress = daoAddresses.pop()!;
  await executeGovernanceProposals(daoFactory, daoAddress, DAO_TOKEN_ID);
  await updateDaoInfo(daoFactory, daoAddress);
}

async function executeGovernanceProposals(
  daoFactory: FTDAOFactory,
  daoEvmAddress: string,
  daoTokenId: TokenId,
) {
  console.log(
    `- executing Governance proposals for given DAO i.e ${daoEvmAddress}, ${daoTokenId}\n`,
  );
  const dao = await daoFactory.getGovernorTokenDaoInstance(daoEvmAddress);
  const governor = await dao.getGovernorAddress();
  const tokenHolder = await daoFactory.getTokenHolderInstance(daoTokenId);
  await GovernanceProps.executeGovernanceProposals(
    tokenHolder,
    governor,
    GovernanceProps.FT_TOKEN_FOR_TRANSFER,
    GovernanceProps.FT_TOKEN_AMOUNT_FOR_TRANSFER,
    GovernanceProps.NFT_TOKEN_FOR_TRANSFER,
    GovernanceProps.CRYPTO_AMOUNT_FOR_TRANSFER,
  );
}

async function updateDaoInfo(daoFactory: FTDAOFactory, daoEvmAddress: string) {
  const dao = await daoFactory.getGovernorTokenDaoInstance(daoEvmAddress);
  await dao.updateDaoInfo(
    "Governor Token Dao - New",
    "dao url - New",
    "info url - New",
    "desc - New",
    [...DAO_WEB_LINKS, "https://github.com"],
    DAO_ADMIN_CLIENT,
  );
}

async function createNewCopies() {
  const deployment = new Deployment();
  await deployment.deployProxyAndSave(ContractService.FT_DAO_FACTORY);
  await deployment.deployProxyAndSave(ContractService.FT_TOKEN_HOLDER_FACTORY);
  new ContractService().makeLatestDeploymentAsDefault();
}

async function setupDAOCreationAllowanceAndGetFeeAmount(factory: DAOFactory) {
  const daoCreationFeeConfig = await factory.feeConfig();
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(daoCreationFeeConfig.tokenAddress),
    factory.contractId,
    daoCreationFeeConfig.proposalFee,
    DEFAULT_DAO_CREATION_FEE_CONFIG.fromAccountId,
    DEFAULT_DAO_CREATION_FEE_CONFIG.fromAccountPK,
    DEFAULT_DAO_CREATION_FEE_CONFIG.fromAccountClient,
  );
  return daoCreationFeeConfig.hBarPayable;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
