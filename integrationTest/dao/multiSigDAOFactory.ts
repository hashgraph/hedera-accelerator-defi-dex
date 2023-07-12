import MultiSigDao from "../../e2e-test/business/MultiSigDao";

import { Helper } from "../../utils/Helper";
import { ContractId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  DAO_LOGO,
  DAO_NAME,
  DAO_DESC,
  executeDAO,
  DAO_WEB_LINKS,
  DAO_OWNERS_ADDRESSES,
} from "./multiSigDAO";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";

async function main() {
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
    const multiSigDAOId = ContractId.fromSolidityAddress(dao);
    const multiSigDAOInstance = new MultiSigDao(multiSigDAOId);
    await executeDAO(multiSigDAOInstance);
  }
  const hasRole = await daoFactory.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await daoFactory.upgradeHederaService(clientsInfo.childProxyAdminClient));
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
