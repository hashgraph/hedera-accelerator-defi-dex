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

const TOKEN_ALLOWANCE_DETAILS = {
  TOKEN: TokenId.fromSolidityAddress(DEFAULT_FEE_CONFIG.tokenAddress),
  FROM_CLIENT: clientsInfo.operatorClient,
  FROM_ID: clientsInfo.operatorId,
  FROM_KEY: clientsInfo.operatorKey,
};

async function main() {
  // await createNewCopies(); // only for dev testing
  const tokenHolderFactory = new FTTokenHolderFactory();
  await tokenHolderFactory.initialize();

  const daoFactory = new FTDAOFactory();
  const feeAmount = await setupDAOCreationAllowanceAndGetFeeAmount(daoFactory);

  await daoFactory.initialize(clientsInfo.operatorClient, tokenHolderFactory);
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
    clientsInfo.operatorClient,
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
  const feeAllowanceAmount = Common.isHBAR(TOKEN_ALLOWANCE_DETAILS.TOKEN)
    ? dex.DAO_FEE
    : DEFAULT_FEE_CONFIG.amountOrId;

  const feeInHBAR = Common.isHBAR(TOKEN_ALLOWANCE_DETAILS.TOKEN)
    ? feeAllowanceAmount
    : 0;

  await Common.setTokenAllowance(
    TOKEN_ALLOWANCE_DETAILS.TOKEN,
    factory.contractId,
    feeAllowanceAmount,
    TOKEN_ALLOWANCE_DETAILS.FROM_ID,
    TOKEN_ALLOWANCE_DETAILS.FROM_KEY,
    TOKEN_ALLOWANCE_DETAILS.FROM_CLIENT,
  );
  return feeInHBAR;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
