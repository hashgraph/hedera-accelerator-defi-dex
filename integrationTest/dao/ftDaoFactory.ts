import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { ContractId, TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import {
  executeGovernorTokenTransferFlow,
  executeContractUpgradeFlow,
  executeTextProposalFlow,
  executeTokenCreateFlow,
} from "./ftDao";
import { clientsInfo } from "../../utils/ClientManagement";

import dex from "../../deployment/model/dex";
import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";
import GodHolder from "../../e2e-test/business/GodHolder";
import FTDAO from "../../e2e-test/business/FTDAO";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_DESC = "Lorem Ipsum is simply dummy text";

const csDev = new ContractService();

export async function executeDAOFlow(
  daoFactory: FTDAOFactory,
  daoProxyAddress: string,
  tokenId: TokenId
) {
  console.log(`- executing TokenTransferDAO i.e ${daoProxyAddress}\n`);

  const ftDao = daoFactory.getGovernorTokenDaoInstance(daoProxyAddress);

  const genericHolder = await daoFactory.getTokenHolderInstance(tokenId);

  const godHolder = genericHolder as GodHolder;

  await executeGovernorTokenTransferFlow(
    godHolder as GodHolder,
    ftDao,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    clientsInfo.operatorId,
    tokenId
  );

  await executeTextProposalFlow(godHolder, ftDao, tokenId);

  await executeContractUpgradeFlow(
    godHolder,
    ftDao,
    csDev.getContractWithProxy(csDev.factoryContractName)
      .transparentProxyAddress!,
    csDev.getContract(csDev.factoryContractName).address,
    tokenId
  );

  await executeTokenCreateFlow(
    godHolder,
    ftDao,
    "tokenName",
    "tokenSymbol",
    clientsInfo.treasureId
  );
}

async function createDAO(
  daoFactory: FTDAOFactory,
  name: string,
  tokenId: TokenId,
  isPrivate: boolean
) {
  await daoFactory.createDAO(
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
  const contract = csDev.getContractWithProxy(ContractService.FT_DAO_FACTORY);
  const proxyId = contract.transparentProxyId!;
  return new FTDAOFactory(ContractId.fromString(proxyId));
}

async function main() {
  const daoFactory = getTokenTransferDAOFactoryInfo();
  const tokenHolderFactory = new FTTokenHolderFactory();
  await daoFactory.initialize(clientsInfo.operatorClient, tokenHolderFactory);
  await daoFactory.getTokenHolderFactoryAddress();
  await createDAO(
    daoFactory,
    dex.GOVERNANCE_DAO_TWO,
    dex.GOVERNANCE_DAO_TWO_TOKEN_ID,
    false
  );
  const daoAddresses = await daoFactory.getDAOs();
  const daoAddress = daoAddresses.pop()!;
  await executeDAOFlow(daoFactory, daoAddress, dex.GOVERNANCE_DAO_TWO_TOKEN_ID);
  const contractId = ContractId.fromSolidityAddress(daoAddress);
  const daoInstance = new FTDAO(contractId);
  await daoInstance.upgradeHederaService();
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
    deployedItems.get(ContractService.GOVERNOR_UPGRADE).address
  );
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
