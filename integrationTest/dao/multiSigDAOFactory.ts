import MultiSigDao from "../../e2e-test/business/MultiSigDao";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";
import Common from "../../e2e-test/business/Common";
import { TokenId } from "@hashgraph/sdk";
import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { ContractService } from "../../deployment/service/ContractService";
import { DEFAULT_DAO_CONFIG } from "../../e2e-test/business/factories/MultiSigDAOFactory";
import {
  DAO_LOGO,
  DAO_NAME,
  DAO_DESC,
  executeHbarTransfer,
  executeDAOTextProposal,
  executeBatchTransaction,
  executeDAOUpgradeProposal,
  executeFTTokenTransferProposal,
  executeNFTTokenTransferProposal,
  DAO_WEB_LINKS,
  DAO_OWNERS_ADDRESSES,
} from "./multiSigDAO";

const TOKEN_ALLOWANCE_DETAILS = {
  TOKEN: TokenId.fromSolidityAddress(DEFAULT_DAO_CONFIG.tokenAddress),
  FROM_CLIENT: clientsInfo.uiUserClient,
  FROM_ID: clientsInfo.uiUserId,
  FROM_KEY: clientsInfo.uiUserKey,
};

async function main() {
  // only for dev testing
  // await createNewCopies();

  const roleBasedAccess = new SystemRoleBasedAccess();
  await roleBasedAccess.initialize();

  const daoFactory = new MultiSigDAOFactory();
  await daoFactory.initialize();
  await Common.setTokenAllowance(
    TOKEN_ALLOWANCE_DETAILS.TOKEN,
    daoFactory.contractId,
    DEFAULT_DAO_CONFIG.daoFee,
    TOKEN_ALLOWANCE_DETAILS.FROM_ID,
    TOKEN_ALLOWANCE_DETAILS.FROM_KEY,
    TOKEN_ALLOWANCE_DETAILS.FROM_CLIENT,
  );
  await daoFactory.createDAO(
    DAO_NAME,
    DAO_LOGO,
    DAO_DESC,
    DAO_WEB_LINKS,
    DAO_OWNERS_ADDRESSES,
    DAO_OWNERS_ADDRESSES.length,
    false,
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

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
