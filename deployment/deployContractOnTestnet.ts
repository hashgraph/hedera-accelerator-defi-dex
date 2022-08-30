import dotenv from "dotenv";
import * as fs from "fs";
import { AccountId, PrivateKey } from "@hashgraph/sdk";
import * as hethers from "@hashgraph/hethers";
dotenv.config();

export class Deployment {
  private createProvider = (): any => {
    return new hethers.providers.HederaProvider(
      "0.0.5", // AccountLike
      "2.testnet.hedera.com:50211", // string
      "https://testnet.mirrornode.hedera.com" // string
    );
  };

  private createEoaAccount = (signerId: string, signerKey: PrivateKey): any => {
    return {
      account: signerId,
      privateKey: `0x${signerKey.toStringRaw()}`, // Convert private key to short format using .toStringRaw()
    };
  };

  private getCompiledContract = (filePath: string) => {
    const rawdata: any = fs.readFileSync(filePath);
    console.log(`Raw data ${rawdata}`);
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
    const signerId = "0.0.47710057";
    const signerKey = PrivateKey.fromString(
      "3030020100300706052b8104000a04220420d38b0ed5f11f8985cd72c8e52c206b512541c6f301ddc9d18bd8b8b25a41a80f"
    ); // TO WORK WITH HETHERS, IT MUST BE ECDSA KEY (FOR NOW);
    const walletAddress = hethers.utils.getAddressFromAccount(signerId);

    // =============================================================================
    // STEP 1 - INITIALIZE A PROVIDER AND WALLET
    console.log(`\n- STEP 1 ===================================`);

    const provider: any = this.createProvider();

    const eoaAccount: any = this.createEoaAccount(signerId, signerKey);

    const wallet = new hethers.Wallet(eoaAccount, provider);

    console.log(`\n- Wallet address: ${wallet.address}`);
    console.log(`\n- Wallet public key: ${wallet.publicKey}`);

    await this.printBalance(wallet, walletAddress);

    // =============================================================================
    // STEP 2 - DEPLOY THE CONTRACT
    console.log(`\n- STEP 2 ===================================`);

    const compiledContract = this.getCompiledContract(filePath);

    // Create a ContractFactory object
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

    // Wait until the transaction reaches consensus (i.e. contract is deployed)
    //  - returns the receipt
    //  - throws on failure (the reciept is on the error)
    const contractDeployWait = await contract.deployTransaction.wait();
    console.log(
      `\n- Contract deployment status: ${contractDeployWait.status!.toString()}`
    );

    // Get the address of the deployed contract
    const contractAddress = contract.address;
    console.log(`\n- Contract address: ${contractAddress}`);

    await this.printBalance(wallet, walletAddress);

    console.log(`\n- DONE ===================================`);
    return contractAddress;
  };
}
