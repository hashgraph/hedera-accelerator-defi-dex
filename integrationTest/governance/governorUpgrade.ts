import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import GodHolder from "../../e2e-test/business/GodHolder";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { ContractService } from "../../deployment/service/ContractService";
import { Client, TokenId, AccountId, PrivateKey } from "@hashgraph/sdk";

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

const txnFeePayerClient = clientsInfo.operatorClient;

const creatorAccountId = clientsInfo.operatorId;
const creatorAccountPK = clientsInfo.operatorKey;
const creatorClient = clientsInfo.operatorClient;

async function main() {
  const voterAccountId = clientsInfo.treasureId;
  const voterAccountKey = clientsInfo.treasureKey;
  const voterClient = clientsInfo.treasureClient;

  const ftTokenHolderFactory = new FTTokenHolderFactory();
  const ftHolderContractId = await ftTokenHolderFactory.getTokenHolder(
    FT_TOKEN_ID.toSolidityAddress()
  );
  const godHolder = new GodHolder(ftHolderContractId);

  const governor = new ContractUpgradeGovernor();
  await governor.cancelProposal(
    "Contract Upgrade Proposal 0x9a2c87ff9df73139e25ae643e1e0702c294fac29",
    creatorClient
  );
  await governor.initialize(
    godHolder,
    txnFeePayerClient,
    1,
    0,
    20,
    FT_TOKEN_ID,
    FT_TOKEN_ID
  );

  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await godHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient
  );

  // tokens locking required in token holder if not enough power locked
  if (votingPowerAmount < quorum) {
    const lockAmount = quorum - votingPowerAmount;
    await godHolder.setupAllowanceForTokenLocking(
      lockAmount,
      voterAccountId,
      voterAccountKey,
      voterClient
    );
    await godHolder.lock(lockAmount, voterClient);
  }

  const contractToUpgradeInfo = new ContractService().getContract(
    ContractService.MULTI_SIG
  );
  await createAndExecuteContractUpgradeProposal(
    contractToUpgradeInfo.transparentProxyAddress!,
    contractToUpgradeInfo.address,
    governor,
    voterClient,
    txnFeePayerClient,
    creatorAccountId,
    creatorAccountPK,
    creatorClient,
    0
  );

  await godHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
}

async function createAndExecuteContractUpgradeProposal(
  proxyAddress: string,
  proxyLogicAddress: string,
  governor: ContractUpgradeGovernor,
  voterClient: Client,
  txnFeePayerClient: Client,
  creatorId: AccountId,
  creatorPK: PrivateKey,
  creatorClient: Client,
  txnFee: number
) {
  await governor.setupAllowanceForProposalCreation(
    creatorClient,
    creatorId,
    creatorPK
  );

  const title = Helper.createProposalTitle("Contract Upgrade Proposal");
  const { proposalId } = await governor.createContractUpgradeProposal(
    proxyAddress,
    proxyLogicAddress,
    title,
    txnFeePayerClient,
    governor.DEFAULT_DESCRIPTION,
    governor.DEFAULT_LINK,
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
    creatorId
  );

  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);

  if (await governor.isSucceeded(proposalId)) {
    await transferOwnershipToGovernance(proposalId, governor);
    await governor.executeProposal(title, undefined, txnFeePayerClient, txnFee);
  } else {
    await governor.cancelProposal(title, creatorClient);
  }
}

async function transferOwnershipToGovernance(
  proposalId: string,
  contractUpgradeGovernor: ContractUpgradeGovernor
) {
  const governorEvmAddress = await AddressHelper.idToEvmAddress(
    contractUpgradeGovernor.contractId
  );
  const { proxyId } =
    await contractUpgradeGovernor.getContractAddressesFromGovernorUpgradeContract(
      proposalId
    );
  await new Common(proxyId).changeAdmin(
    governorEvmAddress,
    clientsInfo.proxyAdminKey,
    clientsInfo.proxyAdminClient
  );
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
