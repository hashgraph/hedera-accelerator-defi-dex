import dex from "../../deployment/model/dex";
import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { Hbar, HbarUnit, TokenId } from "@hashgraph/sdk";
import {
  lockTokenForVotingIfNeeded,
  createAndExecuteTextProposal,
  createAndExecuteTokenCreateProposal,
  createAndExecuteAssetTransferProposal,
  createAndExecuteContractUpgradeProposal,
  createAndExecuteTokenAssociationProposal,
} from "../governance/governance";
import TextGovernor from "../../e2e-test/business/TextGovernor";
import TokenCreateGovernor from "../../e2e-test/business/TokenCreateGovernor";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_ADMIN = clientsInfo.uiUserId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.uiUserClient;
const DAO_LOGO_URL = "https://defi-ui.hedera.com/";
const DAO_TOKEN_ID = dex.GOVERNANCE_DAO_TWO_TOKEN_ID;
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_INFO_URL = "https://daoinfo.com";

const FT_TRANSFER_TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const FT_TRANSFER_TOKEN_AMOUNT = 1e8;

const NFT_TRANSFER_TOKEN_ID = dex.NFT_TOKEN_ID;

const HBAR_TRANSFER_AMOUNT = Hbar.from(1, HbarUnit.Hbar)
  .toTinybars()
  .toNumber();

async function main() {
  // only for dev testing
  // await createNewCopies();
  const tokenHolderFactory = new FTTokenHolderFactory();
  await tokenHolderFactory.initialize();

  const daoFactory = new FTDAOFactory();
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
    20,
    false,
    DAO_ADMIN,
    clientsInfo.operatorClient,
  );
  const daoAddresses = await daoFactory.getDAOs();
  const daoAddress = daoAddresses.pop()!;
  await executeGovernanceProposals(daoFactory, daoAddress, DAO_TOKEN_ID);
  await updateDaoInfo(daoFactory, daoAddress);
  await checkAndUpdateGovernanceLogics(daoFactory);
}

export async function executeGovernanceProposals(
  daoFactory: FTDAOFactory,
  daoEvmAddress: string,
  daoTokenId: TokenId,
) {
  console.log(
    `- executing Governance proposals for given DAO i.e ${daoEvmAddress}, ${daoTokenId}\n`,
  );
  const dao = await daoFactory.getGovernorTokenDaoInstance(daoEvmAddress);
  const tokenHolder = await daoFactory.getTokenHolderInstance(daoTokenId);
  const governanceAddresses =
    await dao.getGovernorTokenTransferContractAddresses();

  const textGovernor = new TextGovernor(
    governanceAddresses.governorTextProposalProxyId,
  );

  const upgradeGovernor = new ContractUpgradeGovernor(
    governanceAddresses.governorUpgradeProxyId,
  );

  const transferGovernor = new TokenTransferGovernor(
    governanceAddresses.governorTokenTransferProxyId,
  );

  const tokenCreateGovernor = new TokenCreateGovernor(
    governanceAddresses.governorTokenCreateProxyId,
  );

  // step - 0 lock required tokens to token holder
  await lockTokenForVotingIfNeeded(
    textGovernor,
    tokenHolder,
    clientsInfo.operatorClient,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.treasureClient,
    0,
  );

  // step - 1 text proposal flow
  await createAndExecuteTextProposal(
    textGovernor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 2 contract upgrade proposal
  const contractToUpgradeInfo = new ContractService().getContract(
    ContractService.MULTI_SIG,
  );
  await createAndExecuteContractUpgradeProposal(
    contractToUpgradeInfo.transparentProxyAddress!,
    contractToUpgradeInfo.address,
    upgradeGovernor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 3 (A) ft token association
  await createAndExecuteTokenAssociationProposal(
    transferGovernor,
    tokenHolder,
    FT_TRANSFER_TOKEN_ID,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 3 (B) ft transfer flow
  await createAndExecuteAssetTransferProposal(
    transferGovernor,
    tokenHolder,
    FT_TRANSFER_TOKEN_ID,
    FT_TRANSFER_TOKEN_AMOUNT,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 4 (A) nft token association
  await createAndExecuteTokenAssociationProposal(
    transferGovernor,
    tokenHolder,
    NFT_TRANSFER_TOKEN_ID,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 4 (B) nft transfer flow
  await createAndExecuteAssetTransferProposal(
    transferGovernor,
    tokenHolder,
    NFT_TRANSFER_TOKEN_ID,
    transferGovernor.DEFAULT_NFT_TOKEN_FOR_TRANSFER,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 5 HBar transfer flow
  await createAndExecuteAssetTransferProposal(
    transferGovernor,
    tokenHolder,
    dex.ZERO_TOKEN_ID,
    HBAR_TRANSFER_AMOUNT,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 6 Token create flow
  await createAndExecuteTokenCreateProposal(
    Helper.createProposalTitle("Test-A", 5),
    Helper.createProposalTitle("Test-A", 5),
    tokenCreateGovernor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    tokenCreateGovernor.TXN_FEE_FOR_TOKEN_CREATE,
  );

  // step - 7 unlock required tokens from token holder
  await tokenHolder.checkAndClaimGodTokens(
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
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

async function checkAndUpdateGovernanceLogics(daoFactory: FTDAOFactory) {
  const roleBasedAccess = new SystemRoleBasedAccess();
  const hasRole = await roleBasedAccess.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await daoFactory.upgradeHederaService(clientsInfo.childProxyAdminClient));
  const deployedItems = await new Deployment().deployContracts([
    ContractService.GOVERNOR_TT,
    ContractService.GOVERNOR_TEXT,
    ContractService.GOVERNOR_UPGRADE,
    ContractService.GOVERNOR_TOKEN_CREATE,
  ]);
  await daoFactory.upgradeGovernorsImplementation(
    deployedItems.get(ContractService.GOVERNOR_TT).address,
    deployedItems.get(ContractService.GOVERNOR_TOKEN_CREATE).address,
    deployedItems.get(ContractService.GOVERNOR_TEXT).address,
    deployedItems.get(ContractService.GOVERNOR_UPGRADE).address,
  );
}

async function createNewCopies() {
  const deployment = new Deployment();
  await deployment.deployProxyAndSave(ContractService.FT_DAO_FACTORY);
  await deployment.deployProxyAndSave(ContractService.FT_TOKEN_HOLDER_FACTORY);
  new ContractService().makeLatestDeploymentAsDefault();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
