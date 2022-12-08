import dotenv from "dotenv";
import * as fs from "fs";
import {
  FileCreateTransaction,
  FileAppendTransaction,
  PrivateKey,
  ContractCreateTransaction,
  Client,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import * as hethers from "@hashgraph/hethers";
import { ContractService } from "../deployment/service/ContractService";
import ClientManagement from "../utils/ClientManagement";
import ContractMetadata from "../utils/ContractMetadata";

dotenv.config();

export class EtherDeployment {
  private contractService = new ContractService();

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
    const contract = await factory.deploy(...contractConstructorArgs, {
      gasLimit: 300000,
    });

    console.log("Contract deployed.");

    // Transaction sent by the wallet (signer) for deployment - for info
    const contractDeployTx = contract.deployTransaction;
    console.log("Transaction sent by the wallet.");

    const contractDeployWait = await contract.deployTransaction.wait();
    console.log(
      `\n- Contract deployment status: ${contractDeployWait.status!.toString()}`
    );

    await this.contractService.recordDeployedContract(
      contract.address,
      compiledContract.contractName
    );

    // Get the address of the deployed contract
    const contractAddress = contract.address;
    console.log(
      `\n- Contract address: ${contractAddress}  Contract Address: ${contract.contractId}`
    );

    await this.printBalance(wallet, walletAddress);

    console.log(`\n- DONE ===================================`);
    return contractAddress;
  };
}

export class Deployment {
  private contractService = new ContractService();
  private clientManagement = new ClientManagement();
  private contractMetadata = new ContractMetadata();

  public deployContractAsAdmin = async (
    filePath: string,
    contractConstructorArgs: ContractFunctionParameters = new ContractFunctionParameters()
  ) => {
    return this.deployContract(
      this.clientManagement.createClientAsAdmin(),
      this.clientManagement.getAdmin().adminKey,
      filePath,
      contractConstructorArgs
    );
  };

  public deployContractAsClient = async (
    filePath: string,
    contractConstructorArgs: ContractFunctionParameters = new ContractFunctionParameters()
  ) => {
    return this.deployContract(
      this.clientManagement.createOperatorClient(),
      this.clientManagement.getOperator().key,
      filePath,
      contractConstructorArgs
    );
  };

  private deployContract = async (
    clientArg: Client,
    operatorKey: PrivateKey,
    filePath: string,
    contractConstructorArgs: ContractFunctionParameters = new ContractFunctionParameters()
  ) => {
    console.log(`\nSTEP 1 - Create file`);
    const rawdata: any = fs.readFileSync(filePath);
    const compiledContract = JSON.parse(rawdata);
    const contractByteCode = compiledContract.bytecode;

    //Create a file on Hedera and store the hex-encoded bytecode
    const fileCreateTx = await new FileCreateTransaction()
      .setKeys([operatorKey])
      .execute(clientArg);
    const fileCreateRx = await fileCreateTx.getReceipt(clientArg);
    const bytecodeFileId = fileCreateRx.fileId;
    console.log(`- The smart contract bytecode file ID is: ${bytecodeFileId}`);

    // Append contents to the file
    const fileAppendTx = await new FileAppendTransaction()
      .setFileId(bytecodeFileId ?? "")
      .setContents(contractByteCode)
      .setMaxChunks(100)
      .execute(clientArg);
    await fileAppendTx.getReceipt(clientArg);
    console.log(`- Content added`);

    console.log(`\nSTEP 2 - Create contract`);
    const contractCreateTx = await new ContractCreateTransaction()
      .setAdminKey(operatorKey)
      .setBytecodeFileId(bytecodeFileId ?? "")
      .setConstructorParameters(contractConstructorArgs)
      .setGas(2000000)
      .execute(clientArg);

    const contractCreateRx = await contractCreateTx.getReceipt(clientArg);
    const contractId = contractCreateRx.contractId;
    console.log(
      `- Contract created ${contractId?.toString()}, Contract Address ${contractId?.toSolidityAddress()}`
    );

    await this.contractService.saveDeployedContract(
      contractId?.toString()!,
      contractId?.toSolidityAddress()!,
      compiledContract.contractName,
      this.contractMetadata.calculateHash(compiledContract.contractName)
    );

    clientArg.close();
    return {
      id: contractId?.toString()!,
      address: "0x" + contractId?.toSolidityAddress()!,
    };
  };
}
