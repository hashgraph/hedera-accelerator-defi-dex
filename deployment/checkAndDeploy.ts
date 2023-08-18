import Web3 from "web3";
import ContractMetadata from "../utils/ContractMetadata";
import ContractUpgradeGovernor from "../e2e-test/business/ContractUpgradeGovernor";

import { Helper } from "../utils/Helper";
import { Deployment } from "../utils/deployContractOnTestnet";
import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "./service/ContractService";
import { DeployedContract } from "./model/contract";

const web3 = new Web3();
const deployment = new Deployment();

const contractMetadata = new ContractMetadata();
const csUAT = new ContractService(ContractService.UAT_CONTRACTS_PATH);

const gitLastCommitMessage = Helper.getGitLastCommitMessage();

async function main() {
  const contractsToDeploy = await contractMetadata.getAllChangedContractNames();
  console.log(`Eligible contracts for upgrade: [${contractsToDeploy}]\n`);
  for (const contractName of contractsToDeploy) {
    const oldVersion = csUAT.getContractWithProxy(contractName);
    const newVersion = await deployment.deploy(contractName);
    await createProposal(oldVersion, newVersion.address);
  }
}

async function createProposal(
  oldVersion: DeployedContract,
  newVersionAddress: string
) {
  const uniqueId = web3.utils.randomHex(20);
  const desc = `Contract Name - ${
    oldVersion.name
  }, New Logic Address =  ${newVersionAddress}, Old Logic Id = ${oldVersion.id!}, Proxy Id = ${oldVersion.transparentProxyId!}`;

  const governor = new ContractUpgradeGovernor();
  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const result = await governor.createContractUpgradeProposal(
    oldVersion.transparentProxyAddress!,
    newVersionAddress,
    `${gitLastCommitMessage} (${uniqueId})`,
    clientsInfo.operatorClient,
    desc
  );
  console.log("Proposal creation status :", result.success, result.proposalId);
  return result.success;
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
