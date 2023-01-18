import { DeployedContract } from "../model/contract";
import { ContractService } from "../service/ContractService";
import { BigNumber } from "bignumber.js";
import { ContractId } from "@hashgraph/sdk";
import ContractMetadata from "../../utils/ContractMetadata";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";

const governor = new GovernorMethods();
const contractService = new ContractService();
const contractMetadata = new ContractMetadata();
const contractUATService = new ContractService(
  ContractService.UAT_CONTRACTS_PATH
);

async function updateProxy(contractId: string, proposalId: BigNumber) {
  const response = await governor.getContractAddresses(contractId, proposalId);
  const proxyUAT = contractUATService.getContractWithProxyById(
    response.proxyIdString
  );
  switch (proxyUAT.name) {
    case contractService.factoryContractName:
    case contractService.splitterContractName:
    case contractService.governorContractName:
    case contractService.governorTextContractName:
    case contractService.governorTTContractName:
    case contractService.governorUpgradeContract: {
      await updateDirectProxy(response.proxyId, response.logicId, proxyUAT);
      break;
    }
  }
}

async function updateDirectProxy(
  proxyId: ContractId,
  logicId: ContractId,
  oldVersion: DeployedContract
) {
  await governor.upgradeTo(
    proxyId.toSolidityAddress(),
    logicId.toSolidityAddress()
  );
  const newContract: DeployedContract = {
    ...oldVersion,
    id: logicId.toString(),
    address: logicId.toSolidityAddress(),
    hash: contractMetadata.calculateHash(oldVersion.name),
    timestamp: new Date().toISOString(),
  };
  contractService.remove(logicId.toString());
  contractService.addDeployed(newContract);
  contractUATService.updateDeployed(newContract);
}

export async function main(contract: DeployedContract, proposal: any) {
  if (contract.name === contractService.governorUpgradeContract) {
    await updateProxy(contract.transparentProxyId!, proposal.proposalId);
  }
}
