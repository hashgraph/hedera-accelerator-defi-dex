import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { main as deployContracts } from "../../deployment/scripts/createContractsE2E";
import {
  AccountId,
  Client,
  ContractId,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";

import dex from "../../deployment/model/dex";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import ContractUpgradeDao from "../../e2e-test/business/contractUpgradeDao";
import * as GovernorTokenMetaData from "../../e2e-test/business/GovernorTokenDao";
import Common from "../../e2e-test/business/Common";

const DOA_ADMIN_ADDRESS = clientsInfo.operatorId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];

async function main() {
  const csDev = new ContractService();
  await deployContracts([
    csDev.governorUpgradeContract,
    csDev.contractUpgradeDao,
    csDev.godHolderContract,
  ]);

  const provider = InstanceProvider.getInstance();

  const godHolder = provider.getFungibleTokenHolder();

  const contractUpgradeGovernor = provider.getGovernor(
    csDev.governorUpgradeContract
  );

  const contractUpgradeDao = provider.getContractUpgradeDao();

  await contractUpgradeDao.initialize(
    DOA_ADMIN_ADDRESS,
    "Contract Upgrade Dao",
    "dao url",
    DAO_DESC,
    DAO_WEB_LINKS,
    contractUpgradeGovernor,
    godHolder,
    clientsInfo.operatorClient,
    GovernorTokenMetaData.DEFAULT_QUORUM_THRESHOLD_IN_BSP,
    GovernorTokenMetaData.DEFAULT_VOTING_DELAY,
    GovernorTokenMetaData.DEFAULT_VOTING_PERIOD,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID,
    dex.GOVERNANCE_DAO_ONE_TOKEN_ID
  );

  await executeContractUpgradeFlow(
    godHolder,
    contractUpgradeDao,
    contractUpgradeGovernor,
    csDev.getContractWithProxy(csDev.factoryContractName)
      .transparentProxyAddress!,
    csDev.getContract(csDev.factoryContractName).address
  );

  await contractUpgradeDao.addWebLink(
    "GIT",
    "https://git.com",
    DAO_ADMIN_CLIENT
  );
  await contractUpgradeDao.updateName(
    "Contract Upgrade Dao - New",
    DAO_ADMIN_CLIENT
  );
  await contractUpgradeDao.updateLogoURL("dao url - New", DAO_ADMIN_CLIENT);
  await contractUpgradeDao.updateDescription("desc - New", DAO_ADMIN_CLIENT);
  await contractUpgradeDao.getDaoDetail();
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}

export async function executeContractUpgradeFlow(
  godHolder: GodHolder,
  contractUpgradeDao: ContractUpgradeDao,
  contractUpgradeGovernor: Governor,
  proxyContract: string,
  contractToUpgrade: string,
  proposalCreatorClient: Client = clientsInfo.operatorClient,
  proposalCreatorAccountId: AccountId = clientsInfo.operatorId,
  proposalCreatorAccountPrivateKey: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountPrivateKey: PrivateKey = clientsInfo.operatorKey
) {
  await godHolder.setupAllowanceForTokenLocking(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await godHolder.lock(
    10005e8,
    voterAccountId,
    voterAccountPrivateKey,
    voterClient
  );

  await contractUpgradeGovernor.setupAllowanceForProposalCreation(
    proposalCreatorClient,
    proposalCreatorAccountId,
    proposalCreatorAccountPrivateKey
  );

  const title = Helper.createProposalTitle("Contract upgrade proposal");

  const proposalId = await contractUpgradeDao.createContractUpgradeProposal(
    title,
    proxyContract,
    contractToUpgrade,
    proposalCreatorClient,
    GovernorTokenMetaData.DEFAULT_DESCRIPTION,
    GovernorTokenMetaData.DEFAULT_LINK,
    ContractId.fromString(contractUpgradeGovernor.contractId)
  );

  await contractUpgradeGovernor.getProposalDetails(proposalId);
  await contractUpgradeGovernor.forVote(proposalId, 0, voterClient);
  await contractUpgradeGovernor.isQuorumReached(proposalId);
  await contractUpgradeGovernor.isVoteSucceeded(proposalId);
  await contractUpgradeGovernor.proposalVotes(proposalId);
  if (await contractUpgradeGovernor.isSucceeded(proposalId)) {
    await contractUpgradeGovernor.executeProposal(
      title,
      clientsInfo.operatorKey,
      clientsInfo.operatorClient
    );
    const { proxyAddress, logicAddress } =
      await contractUpgradeGovernor.getContractAddressesFromGovernorUpgradeContract(
        proposalId
      );
    await Common.upgradeTo(proxyAddress, logicAddress);
  } else {
    await contractUpgradeGovernor.cancelProposal(title, proposalCreatorClient);
  }
  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
}
