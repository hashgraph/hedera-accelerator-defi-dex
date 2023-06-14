import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import { executeGovernorTokenTransferFlow } from "./tokenTransferDAO";

import dex from "../../deployment/model/dex";
import DAOFactory from "../../e2e-test/business/DAOFactory";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_DESC = "Lorem Ipsum is simply dummy text";

export async function executeTokenTransferDAOFlow(
  daoFactory: DAOFactory,
  daoAddresses: string[]
) {
  if (daoAddresses.length > 0) {
    const daoProxyAddress = daoAddresses.pop()!;
    console.log(`- executing TokenTransferDAO i.e ${daoProxyAddress}\n`);

    const tokenTransferDAO =
      daoFactory.getGovernorTokenDaoInstance(daoProxyAddress);

    const governorTokenTransfer =
      await daoFactory.getGovernorTokenTransferInstance(tokenTransferDAO);

    const godHolder = await daoFactory.getGodHolderInstance(
      governorTokenTransfer
    );

    await executeGovernorTokenTransferFlow(
      godHolder,
      tokenTransferDAO,
      governorTokenTransfer
    );
  }
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
  const csDev = new ContractService();
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
  await executeTokenTransferDAOFlow(daoFactory, daoAddresses);
  await daoFactory.upgradeHederaService();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
