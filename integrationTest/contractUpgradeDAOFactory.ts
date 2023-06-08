import { Helper } from "../utils/Helper";
import { ContractId, TokenId } from "@hashgraph/sdk";
import { ContractService } from "../deployment/service/ContractService";
import { executeContractUpgradeFlow } from "./dao/contractUpgradeDAO";

import dex from "../deployment/model/dex";
import DAOFactory from "../e2e-test/business/DAOFactory";
import ContractUpgradeDao from "../e2e-test/business/ContractUpgradeDao";
import Governor from "../e2e-test/business/Governor";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_DESC = "Lorem Ipsum is simply dummy text";

const csDev = new ContractService();

const getContractUpgradeDaoInstance = (daoProxyAddress: string) => {
  const tokenTransferDAOProxyId =
    ContractId.fromSolidityAddress(daoProxyAddress).toString();
  return new ContractUpgradeDao(tokenTransferDAOProxyId);
};

const getGovernorTokenTransferInstance = async (
  contractUpgradeDao: ContractUpgradeDao
) => {
  const contractUpgradeGovernorContractId =
    await contractUpgradeDao.getGovernorAddress();
  return new Governor(contractUpgradeGovernorContractId.toString());
};

export async function executeContractUpgradeDAOFlow(
  daoFactory: TokenTransferDAOFactory,
  daoAddresses: string[]
) {
  if (daoAddresses.length > 0) {
    const daoProxyAddress = daoAddresses.pop()!;
    console.log(`- executing ContractUpgradeDAO i.e ${daoProxyAddress}\n`);

    const contractUpgradeDao = getContractUpgradeDaoInstance(daoProxyAddress);

    const contractUpgradeGovernor = await getGovernorTokenTransferInstance(
      contractUpgradeDao
    );

    const godHolder = await daoFactory.getGodHolderInstance(
      contractUpgradeGovernor
    );

    await executeContractUpgradeFlow(
      godHolder,
      contractUpgradeDao,
      contractUpgradeGovernor,
      csDev.getContractWithProxy(csDev.factoryContractName)
        .transparentProxyAddress!,
      csDev.getContract(csDev.factoryContractName).address
    );
  }
}

async function createDAO(
  daoFactory: DAOFactory,
  name: string,
  tokenId: TokenId,
  isPrivate: boolean
) {
  await daoFactory.createContractUpgradeDao(
    name,
    "https://defi-ui.hedera.com/",
    DAO_DESC,
    DAO_WEB_LINKS,
    tokenId.toSolidityAddress(),
    500,
    0,
    20,
    isPrivate
  );
}

function getTokenTransferDAOFactoryInfo() {
  const csDev = new ContractService();
  const contract = csDev.getContractWithProxy(
    ContractService.CONTRACT_UPGRADE_DAO_FACTORY
  );
  const proxyId = contract.transparentProxyId!;
  return new DAOFactory(proxyId);
}

async function main() {
  const daoFactory = getTokenTransferDAOFactoryInfo();
  await daoFactory.initializeWithContractUpgrade();
  await daoFactory.getGODTokenHolderFactoryAddress();
  await createDAO(
    daoFactory,
    dex.GOVERNANCE_DAO_ONE,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID,
    false
  );
  await createDAO(
    daoFactory,
    dex.GOVERNANCE_DAO_TWO,
    dex.GOVERNANCE_DAO_TWO_TOKEN_ID,
    true
  );
  const daoAddresses = await daoFactory.getDAOs();
  await executeContractUpgradeDAOFlow(daoFactory, daoAddresses);
  await daoFactory.upgradeHederaService();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
