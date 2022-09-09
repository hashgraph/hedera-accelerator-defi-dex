import * as fs from "fs";
import { DeployedContract } from "../model/contract";
import { ContractId } from "@hashgraph/sdk";

export class ContractService {
    private contractRecordFile = ".deployment/state/contracts.json";

    private readFileContent = () => {
        const rawdata: any = fs.readFileSync(this.contractRecordFile);
        return JSON.parse(rawdata);
    };

    public recordDeployedContract = (contractAddress: string, contractName: string) => {
        if (contractName == "transparentupgradeableproxy") {
            return;
        }

        const contracts: [DeployedContract] = this.readFileContent();

        const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);

        const newContract: DeployedContract = {
            name: contractName.toLowerCase(),
            id: contractId.toString(),
            address: contractAddress,
            transparentProxyAddress: null,
            timestamp: new Date().toISOString()
        }

        const contractsWithNewContract = [
            ...contracts,
            newContract
        ]

        const data = JSON.stringify(contractsWithNewContract, null, 4);

        console.log(`Contract details ${data}`);

        fs.writeFileSync(this.contractRecordFile, data);
    }

    public getAllContracts = (): Array<DeployedContract> => this.readFileContent();

    public updateContractRecord = (contractBeingDeployed: DeployedContract, transparentProxyAddress: string) => {

        const contracts: Array<DeployedContract> = this.getAllContracts();
        const allOtherContracts = contracts.filter((contract: DeployedContract) => contract.address != contractBeingDeployed.address);

        const updatedContract = {
            ...contractBeingDeployed,
            transparentProxyAddress: transparentProxyAddress,
            timestamp: new Date().toISOString()
        }

        const updatedContracts = [
            ...allOtherContracts,
            updatedContract
        ]

        const data = JSON.stringify(updatedContracts, null, 4);

        console.log(`Contract record updated ${data}`);

        fs.writeFileSync(this.contractRecordFile, data);

    }

    public getContract = (contractName: string): DeployedContract => {
        const contracts: Array<DeployedContract> = this.getAllContracts();
        const matchingContracts = contracts.filter((contract: DeployedContract) => contract.name == contractName);
        const latestContract = matchingContracts[matchingContracts.length - 1];
        return latestContract;
    }

}