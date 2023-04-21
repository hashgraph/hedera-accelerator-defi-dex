import MultiSigDao from "../e2e-test/business/MultiSigDao";
import MultiSigDAOFactory from "../e2e-test/business/factories/MultiSigDAOFactory";

import { Helper } from "../utils/Helper";
import { ContractId } from "@hashgraph/sdk";
import { ContractService } from "../deployment/service/ContractService";
import {
  DAO_LOGO,
  DAO_NAME,
  executeDAO,
  DAO_OWNERS_ADDRESSES,
} from "./multiSigDAO";

async function main() {
  const daoFactory = getMultiSigFactoryInstance();
  await daoFactory.initialize();
  await daoFactory.createDAO(
    DAO_NAME,
    DAO_LOGO,
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
}

function getMultiSigFactoryInstance() {
  const factoryContractId = new ContractService().getContractWithProxy(
    ContractService.MULTI_SIG_FACTORY
  ).transparentProxyId!;
  return new MultiSigDAOFactory(factoryContractId);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
