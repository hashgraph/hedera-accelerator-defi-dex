import dex from "../../deployment/model/dex";
import TextDao from "../../e2e-test/business/TextDao";
import DAOFactory from "../../e2e-test/business/DAOFactory";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { executeTextProposalFlow } from "./textDAO";

const provider = InstanceProvider.getInstance();
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];

const getGovernorInstance = async (textDao: TextDao) => {
  return provider.getGovernor(
    ContractService.GOVERNOR_TEXT,
    (await textDao.getGovernorAddress()).toString()
  );
};

export async function executeTextDAOFlow(
  daoFactory: DAOFactory,
  daoAddresses: string[]
) {
  if (daoAddresses.length > 0) {
    const daoProxyAddress = daoAddresses.pop()!;
    console.log(`- executing TextDAO i.e ${daoProxyAddress}\n`);
    const textDao = provider.getTextDao(daoProxyAddress);
    const textGovernor = await getGovernorInstance(textDao);
    const godHolder = await daoFactory.getGodHolderInstance(textGovernor);
    await executeTextProposalFlow(godHolder, textDao, textGovernor);
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

async function main() {
  const daoFactory = provider.getTextDaoFactory();
  await daoFactory.initializeWithTextGovernance();
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
  await executeTextDAOFlow(daoFactory, daoAddresses);
  await daoFactory.upgradeHederaService();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
