import MultiSigDao from "../../e2e-test/business/MultiSigDao";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";
import Common from "../../e2e-test/business/Common";
import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { ContractService } from "../../deployment/service/ContractService";
import { DEFAULT_FEE_CONFIG } from "../../e2e-test/business/constants";
import { DEFAULT_PROPOSAL_CREATION_FEE_CONFIG } from "../../e2e-test/business/constants";

import {
  DAO_LOGO,
  DAO_NAME,
  DAO_DESC,
  DAO_INFO_URL,
  DAO_WEB_LINKS,
  DAO_ADMIN_ADDRESS,
  executeHbarTransfer,
  DAO_OWNERS_ADDRESSES,
  executeDAOTextProposal,
  executeBatchTransaction,
  executeDAOUpgradeProposal,
  executeFTTokenTransferProposal,
  executeNFTTokenTransferProposal,
} from "./multiSigDAO";

const DEFAULT_DAO_CREATION_FEE_CONFIG = {
  ...DEFAULT_FEE_CONFIG,
  fromAccountId: clientsInfo.operatorId,
  fromAccountPK: clientsInfo.operatorKey,
  fromAccountClient: clientsInfo.operatorClient,
};

async function main() {
  // only for dev testing
  // await createNewCopies();

  const roleBasedAccess = new SystemRoleBasedAccess();
  await roleBasedAccess.initialize();

  const daoFactory = new MultiSigDAOFactory();
  await daoFactory.initialize(DEFAULT_FEE_CONFIG);

  const feeAmount = await setupDAOCreationAllowanceAndGetFeeAmount(daoFactory);
  await daoFactory.createDAO(
    DAO_NAME,
    DAO_LOGO,
    DAO_INFO_URL,
    DAO_DESC,
    DAO_WEB_LINKS,
    DAO_OWNERS_ADDRESSES,
    DAO_OWNERS_ADDRESSES.length,
    false,
    feeAmount,
    DEFAULT_PROPOSAL_CREATION_FEE_CONFIG,
    DAO_ADMIN_ADDRESS,
    DEFAULT_DAO_CREATION_FEE_CONFIG.fromAccountClient,
  );
  const addresses = await daoFactory.getDAOs();
  if (addresses.length > 0) {
    const dao = addresses.pop()!;
    const multiSigDAOId = await AddressHelper.addressToIdObject(dao);
    const multiSigDAO = new MultiSigDao(multiSigDAOId);
    await executeHbarTransfer(multiSigDAO);
    await executeDAOTextProposal(multiSigDAO);
    await executeBatchTransaction(multiSigDAO);
    await executeDAOUpgradeProposal(multiSigDAO);
    await executeFTTokenTransferProposal(multiSigDAO);
    await executeNFTTokenTransferProposal(multiSigDAO);
  }
  const hasRole = await roleBasedAccess.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await daoFactory.upgradeHederaService(clientsInfo.childProxyAdminClient));
}

async function createNewCopies() {
  const deployment = new Deployment();
  await deployment.deployProxyAndSave(ContractService.MULTI_SIG_FACTORY);
  new ContractService().makeLatestDeploymentAsDefault();
}

async function setupDAOCreationAllowanceAndGetFeeAmount(
  factory: MultiSigDAOFactory,
) {
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

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
