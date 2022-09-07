import dotenv from "dotenv";
import * as fs from "fs";
import { PrivateKey } from "@hashgraph/sdk";
import * as hethers from "@hashgraph/hethers";
import { DeployedContract } from "./model/contract";
import {
  ContractId
} from "@hashgraph/sdk";

dotenv.config();

export const contractRecordFile = "./contracts.json";

export class Deployment {

  private createProvider = (): any => {
    return new hethers.providers.HederaProvider(
      "0.0.5", // AccountLike
      "2.testnet.hedera.com:50211",
      "https://testnet.mirrornode.hedera.com"
    );
  };

  private createEoaAccount = (signerId: string, signerKey: PrivateKey): any => {
    return {
      account: signerId,
      privateKey: `0x${signerKey.toStringRaw()}`, // Convert private key to short format using .toStringRaw()
    };
  };

  private readFileContent = (filePath: string) => {
    const rawdata: any = fs.readFileSync(filePath);
    return JSON.parse(rawdata);
  };

  private printBalance = async (wallet: any, walletAddress: string) => {
    const balance = await wallet.getBalance(walletAddress);

    console.log(
      `\n- Wallet address balance: ${hethers.utils.formatHbar(
        balance.toString()
      )} hbar`
    );
  };

  private recordDeployedContracts = (contract: any, contractName: string) => {
    const contracts: [DeployedContract] = this.readFileContent(contractRecordFile);
    
    const newContract: DeployedContract = {
      name: contractName.toLowerCase(),
      id: "Need to figure out",
      address: contract.address,
      transparentProxyAddress: '',
      timestamp: new Date().toISOString()
    }

    const newContents = [
      ...contracts,
      newContract
    ]

    const data = JSON.stringify(newContents, null, 4);

    console.log(`Contract details ${data}`);

    fs.writeFileSync(contractRecordFile, data);
  }

  public deployContract = async (
    filePath: string,
    contractConstructorArgs: Array<any>
  ) => {
    const signerId = process.env.OPERATOR_ID!;
    const signerKey = PrivateKey.fromString(process.env.OPERATOR_KEY!); // TO WORK WITH HETHERS, IT MUST BE ECDSA KEY (FOR NOW);
    const walletAddress = hethers.utils.getAddressFromAccount(signerId);

    // =============================================================================
    // STEP 1 - INITIALIZE A PROVIDER AND WALLET
    console.log(`\n- STEP 1 ===================================`);

    const provider: any = this.createProvider();

    const eoaAccount: any = this.createEoaAccount(signerId, signerKey);

    const wallet = new hethers.Wallet(eoaAccount, provider);

    console.log(`\n- Wallet signerId: ${signerId}`);

    await this.printBalance(wallet, walletAddress);

    // =============================================================================
    // STEP 2 - DEPLOY THE CONTRACT
    console.log(`\n- STEP 2 ===================================`);

    const compiledContract = this.readFileContent(filePath);

    const factory = new hethers.ContractFactory(
      compiledContract.abi,
      compiledContract.bytecode,
      wallet
    );

    console.log("Deploying contract...");

    // Deploy the contract
    const contract = await factory.deploy(...contractConstructorArgs, {gasLimit: 300000});

    console.log("Contract deployed.");

    this.recordDeployedContracts(contract, compiledContract.contractName);

    // Transaction sent by the wallet (signer) for deployment - for info
    const contractDeployTx = contract.deployTransaction;
    console.log("Transaction sent by the wallet.");

    const contractDeployWait = await contract.deployTransaction.wait();
    console.log(`\n- Contract deployment status: ${contractDeployWait.status!.toString()}`);

    // Get the address of the deployed contract
    const contractAddress = contract.address;
    console.log(`\n- Contract address: ${contractAddress}`);

    await this.printBalance(wallet, walletAddress);

    console.log(`\n- DONE ===================================`);
    return contractAddress;
  };
}
