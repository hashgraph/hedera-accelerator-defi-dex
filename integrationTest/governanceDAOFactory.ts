import { TokenId } from "@hashgraph/sdk";
import { ContractService } from "../deployment/service/ContractService";
import { executeGovernorTokenTransferFlow } from "./dao/daoGovernorToken";

import dex from "../deployment/model/dex";
import GovernanceDAOFactory from "../e2e-test/business/GovernanceDAOFactory";

const csDev = new ContractService();
const governanceDaoFactoryContract = csDev.getContractWithProxy(
  csDev.governanceDaoFactory
);
const governanceDaoFactoryProxyContractId =
  governanceDaoFactoryContract.transparentProxyId!;

const governanceDAOFactory = new GovernanceDAOFactory(
  governanceDaoFactoryProxyContractId
);

async function executeGovernorTokenDAOFlow(daoAddresses: string[]) {
  if (daoAddresses.length > 0) {
    const daoProxyAddress = daoAddresses.pop()!;
    console.log(`- executing GovernorTokenDAO i.e ${daoProxyAddress}\n`);

    const governorTokenDao =
      governanceDAOFactory.getGovernorTokenDaoInstance(daoProxyAddress);

    const governorTokenTransfer =
      await governanceDAOFactory.getGovernorTokenTransferInstance(
        governorTokenDao
      );

    const godHolder = await governanceDAOFactory.getGodHolderInstance(
      governorTokenTransfer
    );

    await executeGovernorTokenTransferFlow(
      godHolder,
      governorTokenDao,
      governorTokenTransfer
    );
  }
}

async function createDAO(name: string, tokenId: TokenId, isPrivate: boolean) {
  await governanceDAOFactory.createDAO(
    name,
    "https://defi-ui.hedera.com/",
    tokenId.toSolidityAddress(),
    500,
    0,
    20,
    isPrivate
  );
}

async function main() {
  await governanceDAOFactory.initialize(governanceDaoFactoryContract.name);
  await governanceDAOFactory.getGODTokenHolderFactoryAddress();
  await createDAO(
    dex.GOVERNANCE_DAO_ONE,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID,
    false
  );
  await createDAO(
    dex.GOVERNANCE_DAO_TWO,
    dex.GOVERNANCE_DAO_TWO_TOKEN_ID,
    true
  );
  const daoAddresses = await governanceDAOFactory.getDAOs();
  await executeGovernorTokenDAOFlow(daoAddresses);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
