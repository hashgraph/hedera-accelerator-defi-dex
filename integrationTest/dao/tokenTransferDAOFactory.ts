import { Helper } from "../../utils/Helper";
import { ContractId, TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import {
  executeGovernorTokenTransferFlow,
  executeContractUpgradeFlow,
  executeTextProposalFlow,
} from "./tokenTransferDAO";
import { clientsInfo } from "../../utils/ClientManagement";

import dex from "../../deployment/model/dex";
import DAOFactory from "../../e2e-test/business/DAOFactory";
import { InstanceProvider } from "../../utils/InstanceProvider";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_DESC = "Lorem Ipsum is simply dummy text";

const csDev = new ContractService();

export async function executeDAOFlow(
  daoFactory: DAOFactory,
  daoProxyAddress: string,
  tokenId: TokenId
) {
  console.log(`- executing TokenTransferDAO i.e ${daoProxyAddress}\n`);

  const tokenTransferDAO =
    daoFactory.getGovernorTokenDaoInstance(daoProxyAddress);

  const godHolder = await daoFactory.getGodHolderInstance(tokenId);

  await executeGovernorTokenTransferFlow(
    godHolder,
    tokenTransferDAO,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.operatorId,
    tokenId
  );

  await executeTextProposalFlow(godHolder, tokenTransferDAO, tokenId);

  await executeContractUpgradeFlow(
    godHolder,
    tokenTransferDAO,
    csDev.getContractWithProxy(csDev.factoryContractName)
      .transparentProxyAddress!,
    csDev.getContract(csDev.factoryContractName).address,
    tokenId
  );
}

async function createDAO(
  daoFactory: DAOFactory,
  name: string,
  tokenId: TokenId,
  isPrivate: boolean
) {
  await daoFactory.createTokenTransferDao(
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
  const contract = csDev.getContractWithProxy(csDev.tokenTransferDAOFactory);
  const proxyId = contract.transparentProxyId!;
  return new DAOFactory(proxyId);
}

async function main() {
  const daoFactory = getTokenTransferDAOFactoryInfo();
  await daoFactory.initialize();
  await daoFactory.getGODTokenHolderFactoryAddress();
  await createDAO(
    daoFactory,
    dex.GOVERNANCE_DAO_TWO,
    dex.GOVERNANCE_DAO_TWO_TOKEN_ID,
    false
  );
  const daoAddresses = await daoFactory.getDAOs();
  const daoAddress = daoAddresses[0];
  await executeDAOFlow(daoFactory, daoAddress, dex.GOVERNANCE_DAO_TWO_TOKEN_ID);
  const contractId = ContractId.fromSolidityAddress(daoAddress);
  const daoInstance = InstanceProvider.getInstance().getGovernorTokenDao(
    contractId.toString()
  );
  await daoInstance.upgradeHederaService();
  await daoFactory.upgradeGovernorsImplementation(
    csDev.getContract(ContractService.GOVERNOR_TT).address,
    csDev.getContract(ContractService.GOVERNOR_TOKEN_CREATE).address,
    csDev.getContract(ContractService.GOVERNOR_TEXT).address,
    csDev.getContract(ContractService.GOVERNOR_UPGRADE).address
  );
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
