import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../deployment/service/ContractService";
import { executeGovernorTokenTransferFlow } from "./dao/daoGovernorToken";

import dex from "../deployment/model/dex";
import GovernanceDAOFactory from "../e2e-test/business/GovernanceDAOFactory";

export async function executeGovernorTokenDAOFlow(
  daoFactory: GovernanceDAOFactory,
  daoAddresses: string[]
) {
  if (daoAddresses.length > 0) {
    const daoProxyAddress = daoAddresses.pop()!;
    console.log(`- executing GovernorTokenDAO i.e ${daoProxyAddress}\n`);

    const governorTokenDao =
      daoFactory.getGovernorTokenDaoInstance(daoProxyAddress);

    const governorTokenTransfer =
      await daoFactory.getGovernorTokenTransferInstance(governorTokenDao);

    const godHolder = await daoFactory.getGodHolderInstance(
      governorTokenTransfer
    );

    await executeGovernorTokenTransferFlow(
      godHolder,
      governorTokenDao,
      governorTokenTransfer
    );
  }
}

async function createDAO(
  daoFactory: GovernanceDAOFactory,
  name: string,
  tokenId: TokenId,
  isPrivate: boolean
) {
  await daoFactory.createDAO(
    name,
    "https://defi-ui.hedera.com/",
    tokenId.toSolidityAddress(),
    500,
    0,
    20,
    isPrivate
  );
}

function getGovernanceDAOFactoryInfo() {
  const csDev = new ContractService();
  const contract = csDev.getContractWithProxy(csDev.governanceDaoFactory);
  const proxyId = contract.transparentProxyId!;
  const daoFactory = new GovernanceDAOFactory(proxyId);
  return { daoFactory, contractName: contract.name };
}

async function main() {
  const { daoFactory, contractName } = getGovernanceDAOFactoryInfo();
  await daoFactory.initialize(contractName);
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
  await executeGovernorTokenDAOFlow(daoFactory, daoAddresses);
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
