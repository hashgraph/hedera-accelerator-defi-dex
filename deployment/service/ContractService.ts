import * as fs from "fs";
import { DeployedContract } from "../model/contract";
import { httpRequest } from "../api/HttpsService";

export class ContractService {
    private contractRecordFile = "./deployment/state/contracts.json";

    private readFileContent = () => {
        const rawdata: any = fs.readFileSync(this.contractRecordFile);
        return JSON.parse(rawdata);
    };

    public getContractId = async (contractEvmAddress: string): Promise<any>  => {
        console.log(`Fetching contract id for evm address ${contractEvmAddress}`);
        const contractId: any = await httpRequest(contractEvmAddress, undefined);
        console.log(`Contract id for evm address ${contractId}`);
        return contractId.contract_id;
    }

    public recordDeployedContract = async (contractAddress: string, contractName: string) => {
        if (contractName === "transparentupgradeableproxy") {
            return;
        }

        const contracts: [DeployedContract] = this.readFileContent();

        const contractId = await this.getContractId(contractAddress);

        const newContract: DeployedContract = {
            name: contractName.toLowerCase(),
            id: contractId,
            address: contractAddress,
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

    public updateContractRecord = (updatedContract: DeployedContract, contractBeingDeployed: DeployedContract) => {

        const contracts: Array<DeployedContract> = this.getAllContracts();
        const allOtherContracts = contracts.filter((contract: DeployedContract) => contract.address != contractBeingDeployed.address);

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

    public getContractWithProxy = (contractName: string): DeployedContract => {
        const contracts: Array<DeployedContract> = this.getAllContracts();
        const matchingProxyContracts = contracts.filter((contract: DeployedContract) => contract.name == contractName 
            && (contract.transparentProxyAddress != null 
            && contract.transparentProxyId != null));
        return matchingProxyContracts[0];//Proxy is associated to only one contract
    }

}

async function main() {
    const s = new ContractService();
    const id = await s.getContractId("0x0000000000000000000000000000000002dfa2d5");
    console.log(`id ${id}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });