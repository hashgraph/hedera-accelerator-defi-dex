import MultiSigDao from "../../e2e-test/business/MultiSigDao";

import { Helper } from "../../utils/Helper";
import { ContractId } from "@hashgraph/sdk";
import { InstanceProvider } from "../../utils/InstanceProvider";
import {
  DAO_LOGO,
  DAO_NAME,
  DAO_DESC,
  executeDAO,
  DAO_WEB_LINKS,
  DAO_OWNERS_ADDRESSES,
} from "./multiSigDAO";

async function main() {
  const daoFactory = InstanceProvider.getInstance().getMultiSigDAOFactory();
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
    const multiSigDAOId = ContractId.fromSolidityAddress(dao).toString();
    const multiSigDAOInstance = new MultiSigDao(multiSigDAOId);
    await executeDAO(multiSigDAOInstance);
  }
  await daoFactory.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
