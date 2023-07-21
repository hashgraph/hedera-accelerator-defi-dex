import MultiSigDao from "../../e2e-test/business/MultiSigDao";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import {
  DAO_LOGO,
  DAO_NAME,
  DAO_DESC,
  executeDAOTextProposal,
  executeBatchTransaction,
  executeDAOTokenTransferProposal,
  DAO_WEB_LINKS,
  DAO_OWNERS_ADDRESSES,
} from "./multiSigDAO";

async function main() {
  const roleBasedAccess = new SystemRoleBasedAccess();
  const daoFactory = new MultiSigDAOFactory();
  await daoFactory.initialize();
  await daoFactory.createDAO(
    DAO_NAME,
    DAO_LOGO,
    DAO_DESC,
    DAO_WEB_LINKS,
    DAO_OWNERS_ADDRESSES,
    DAO_OWNERS_ADDRESSES.length,
    false
  );
  const addresses = await daoFactory.getDAOs();
  if (addresses.length > 0) {
    const dao = addresses.pop()!;
    const multiSigDAOId = await AddressHelper.addressToIdObject(dao);
    const multiSigDAOInstance = new MultiSigDao(multiSigDAOId);
    await executeDAOTextProposal(multiSigDAOInstance);
    await executeBatchTransaction(multiSigDAOInstance);
    await executeDAOTokenTransferProposal(multiSigDAOInstance);
  }
  const hasRole = await roleBasedAccess.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await daoFactory.upgradeHederaService(clientsInfo.childProxyAdminClient));
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
