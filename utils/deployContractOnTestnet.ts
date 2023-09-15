import * as fs from "fs";
import * as hethers from "@hashgraph/hethers";
import ContractMetadata from "../utils/ContractMetadata";

import { clientsInfo } from "../utils/ClientManagement";
import { ContractService } from "../deployment/service/ContractService";
import { DeployedContract } from "../deployment/model/contract";
import {
  Key,
  Client,
  PrivateKey,
  ContractCreateFlow,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

import dotenv from "dotenv";
dotenv.config();

export class EtherDeployment {
  private contractService = new ContractService();

  private createProvider = (): any => {
    return new hethers.providers.HederaProvider(
      "0.0.5", // AccountLike
      "2.testnet.hedera.com:50211",
      "https://testnet.mirrornode.hedera.com",
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
        balance.toString(),
      )} hbar`,
    );
  };

  public deployContract = async (
    filePath: string,
    contractConstructorArgs: Array<any>,
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
      wallet,
    );

    console.log("Deploying contract...");

    // Deploy the contract
    const contract = await factory.deploy(...contractConstructorArgs, {
      gasLimit: 300000,
    });

    console.log("Contract deployed.");

    // Transaction sent by the wallet (signer) for deployment - for info
    const contractDeployTx = contract.deployTransaction;
    console.log("Transaction sent by the wallet.");

    const contractDeployWait = await contract.deployTransaction.wait();
    console.log(
      `\n- Contract deployment status: ${contractDeployWait.status!.toString()}`,
    );

    await this.contractService.recordDeployedContract(
      contract.address,
      compiledContract.contractName,
    );

    // Get the address of the deployed contract
    const contractAddress = contract.address;
    console.log(
      `\n- Contract address: ${contractAddress}  Contract Address: ${contract.contractId}`,
    );

    await this.printBalance(wallet, walletAddress);

    console.log(`\n- DONE ===================================`);
    return contractAddress;
  };
}

export class Deployment {
  private contractService = new ContractService();
  private contractMetadata = new ContractMetadata();

  public deploy = async (
    contractName: string,
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
    params: ContractFunctionParameters = new ContractFunctionParameters(),
  ) => {
    console.log(`- Deployment#deploy(): ${contractName} logic deploying...\n`);
    const result = await this._deployInternally(
      contractName,
      "",
      adminKey,
      client,
      params,
    );
    console.log(
      `- Deployment#deploy(): done where contract-name = ${contractName}, id = ${result.id}, address = ${result.address}\n`,
    );
    return result;
  };

  public deployAndSave = async (
    contractName: string,
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
    params: ContractFunctionParameters = new ContractFunctionParameters(),
  ) => {
    const result = await this.deploy(contractName, adminKey, client, params);
    this.contractService.addDeployed(result);
    return result;
  };

  public deployContracts = async (
    names: string[],
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const deployedItems = new Map<String, any>();
    const pendingItems = names.map(async (name: string) => {
      const item = await this.deploy(name, adminKey, client);
      deployedItems.set(name, item);
    });
    await Promise.all(pendingItems);
    return deployedItems;
  };

  public deployProxy = async (
    contractName: string,
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
  ) => {
    console.log(
      `- Deployment#deployProxy(): ${contractName} proxy deploying...\n`,
    );
    const logic = await this._deployInternally(
      contractName,
      "",
      adminKey,
      client,
    );
    const proxy = await this.deployProxyForGivenLogic(logic, adminKey, client);
    console.log(`- Deployment#deployProxy(): done`);
    console.table(proxy);
    console.log("\n");
    return proxy;
  };

  public deployProxyAndSave = async (
    contractName: string,
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const result = await this.deployProxy(contractName, adminKey, client);
    this.contractService.addDeployed(result);
    return result;
  };

  public deployProxies = async (
    names: string[],
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const deployedItems = new Map<String, DeployedContract>();
    const pendingItems = names.map(async (name: string) => {
      const item = await this.deployProxy(name, adminKey, client);
      deployedItems.set(name, item);
    });
    await Promise.all(pendingItems);
    return deployedItems;
  };

  public deployProxyForGivenLogic = async (
    logic: DeployedContract,
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
  ) => {
    const proxy = await this._deployInternally(
      "TransparentUpgradeableProxy",
      logic.name,
      adminKey,
      client,
      new ContractFunctionParameters()
        .addAddress(logic.address)
        .addAddress(clientsInfo.proxyAdminId.toSolidityAddress())
        .addBytes(new Uint8Array()),
    );
    return {
      ...logic,
      transparentProxyId: proxy.id,
      transparentProxyAddress: proxy.address,
      timestamp: new Date().toISOString(),
    };
  };

  private _deployInternally = async (
    contractName: string,
    additionalInfo: string,
    adminKey: Key = clientsInfo.operatorKey.publicKey,
    client: Client = clientsInfo.operatorClient,
    params: ContractFunctionParameters = new ContractFunctionParameters(),
  ) => {
    let contractMemo = contractName;
    if (additionalInfo.length > 0) {
      contractMemo += ` (${additionalInfo})`;
    }
    const info = await this.contractMetadata.getContractInfo(contractName);
    const txn = new ContractCreateFlow()
      .setConstructorParameters(params)
      .setBytecode(info.artifact.bytecode)
      .setContractMemo(contractMemo)
      .setGas(2_000_000)
      .setAdminKey(adminKey);

    const txnResponse = await txn.execute(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    const id = txnReceipt.contractId!.toString();
    const address = "0x" + txnReceipt.contractId!.toSolidityAddress();

    return {
      name: contractName.toLowerCase(),
      id,
      hash: info.hash,
      address,
      timestamp: new Date().toISOString(),
    };
  };
}
