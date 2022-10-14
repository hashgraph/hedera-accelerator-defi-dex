import Web3 from "web3";
import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  AccountId
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { EventConsumer } from "./utils/EventConsumer";
import { ContractService } from "../deployment/service/ContractService";
import { ethers } from "ethers";

const web3 = new Web3;

const eventConsumer = new EventConsumer("./artifacts/contracts/common/GovernorCountingSimpleInternal.sol/GovernorCountingSimpleInternal.json");

const clientManagement = new ClientManagement();
const contractService = new ContractService();


let client = clientManagement.createOperatorClient();
const {id, key} = clientManagement.getOperator();
const { adminId, adminKey } = clientManagement.getAdmin();

const treasurerClient = clientManagement.createClient();
const {treasureId, treasureKey} = clientManagement.getTreasure();

const htsServiceAddress = contractService.getContract(contractService.baseContractName).address;

const contractId = contractService.getContractWithProxy(contractService.governorContractName).transparentProxyId!;

const precision = 10000000;

const readFileContent = (filePath: string) => {
    const rawdata: any = fs.readFileSync(filePath);
    return JSON.parse(rawdata);
  };

const createToken =  async (): Promise<TokenId> => {
    const createTokenTx = await new TokenCreateTransaction()
      .setTokenName("Governance Hedera Open DEX")
      .setTokenSymbol("GOD")
      .setDecimals(8)
      .setInitialSupply(20000000000000)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(treasureKey)
      .setAdminKey(treasureKey)
      .setTreasuryAccountId(treasureId)
      .execute(treasurerClient);
    
      const tokenCreateTx = await createTokenTx.getReceipt(treasurerClient);
      const tokenId = tokenCreateTx.tokenId;
      console.log(`Token created ${tokenId}, Token Address ${tokenId?.toSolidityAddress()}`);
      return tokenId!;
  }
  

const initialize = async (tokenId: TokenId) => {
  console.log(`Initialize contract with token  `);
  const votingDelay = 1;
  const votingPeriod = 50400;
  const blockNumber = 1;

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(tokenId.toSolidityAddress())
    // .addUint256(votingDelay)
    // .addUint256(votingPeriod)
    // .addUint256(blockNumber)

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(500000)
    .execute(client);
    
  await contractTokenTx.getReceipt(client);

  console.log(`Initialize contract with token done.`);
}

const propose = async (targets: Array<string>, ethFees: Array<number>, calls: Array<Uint8Array>, description: string) => {
    console.log(`Propose `);
  
    const contractFunctionParameters = new ContractFunctionParameters()
        .addAddressArray(targets)
        .addUint256Array(ethFees)
        .addBytesArray(calls)
        .addString(description);

    const contractAllotTx = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setFunction("propose", contractFunctionParameters)
        .setGas(900000)
        .freezeWith(client);
    
    const executedTx = await contractAllotTx.execute(client);

    const record = await executedTx.getRecord(client);
    const contractAllotRx = await executedTx.getReceipt(client);

    // const logs = await eventConsumer.getEventsFromRecord(record.contractFunctionResult?.logs, "ProposalCreated");
    // logs.forEach(log => {
    //     console.log(JSON.stringify(log));
    // });

    const status = contractAllotRx.status;
    console.log(`propose ${status}`);
    const proposalId = record.contractFunctionResult?.getUint256(0)!;
    console.log(`Proposal id ${proposalId}`);
    return proposalId;
}

const vote = async (proposalId: BigNumber, voteId:  number) => {
  console.log(`Vote for proposal id ${proposalId} `);
  const contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId)
      .addUint8(voteId);

  const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("castVote", contractFunctionParameters)
      .setGas(900000)
      .freezeWith(treasurerClient);
  
  const executedTx = await contractAllotTx.execute(treasurerClient);

  const response = await executedTx.getRecord(client);
  const contractAllotRx = await executedTx.getReceipt(treasurerClient);

  const logs = await eventConsumer.getEventsFromRecord(response.contractFunctionResult?.logs, "VoteCast");
    logs.forEach(log => {
        console.log(JSON.stringify(log));
    });

  const status = contractAllotRx.status;
  console.log(`Vote ${status}`);
  console.log(`id ${response.contractFunctionResult?.getUint256(0)}`);
}

const execute = async (targets: Array<string>, ethFees: Array<number>, calls: Array<Uint8Array>, description: string) => {
  console.log(`Execute  proposal - `);

  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray(targets)
    .addUint256Array(ethFees)
    .addBytesArray(calls)
    .addString(description);

  const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("execute", contractFunctionParameters)
      .setGas(900000)
      .freezeWith(treasurerClient);
  
  const executedTx = await contractAllotTx.execute(treasurerClient);

  const response = await executedTx.getRecord(client);
  const contractAllotRx = await executedTx.getReceipt(treasurerClient);

  const status = contractAllotRx.status;
  console.log(`execute ${status}`);
  console.log(`id ${response.contractFunctionResult?.getUint256(0)}`);
}
//function transferTokenPublic(address token, address sender, address receiver, int amount) 
const transferTokenPublicCallData = async (tokenId: TokenId): Promise<Uint8Array> => {
    const contractJson = readFileContent("./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json");
    const contractInterface = new ethers.utils.Interface(contractJson.abi);
    const sender = treasureId.toSolidityAddress();
    const receiver = adminId.toSolidityAddress();
    const callData = contractInterface.encodeFunctionData("transferTokenPublic", [tokenId.toSolidityAddress(), sender, receiver, 50]);
    return Buffer.from(callData, "hex");
}

//function associateTokenPublic(address account, address token) external override returns (int responseCode) {
const associateTokenPublicCallData = async (tokenId: TokenId): Promise<Uint8Array> => {
  const contractJson = readFileContent("./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json");
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  
  const receiver = adminId.toSolidityAddress();
  const callData = contractInterface.encodeFunctionData("associateTokenPublic", [receiver, tokenId.toSolidityAddress()]);
  return ethers.utils.toUtf8Bytes(callData);;
}

const tokenSupply = async (): Promise<Uint8Array> => {
  const contractJson = readFileContent("./artifacts/contracts/common/IERC20.sol/IERC20.json");
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData("totalSupply");
  return ethers.utils.toUtf8Bytes(callData);;
}

const getVotes = async (accountId: AccountId) => {
  console.log(`getVotes `);

  let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(accountId.toSolidityAddress())
      .addUint256(1);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("getVotes", contractFunctionParameters)
    .setGas(500000)
    .execute(client);
    
  await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const weight = record.contractFunctionResult!.getInt256(0);

  console.log(`getVotes ${weight}`);
}


const quorumReached = async (proposalId: BigNumber) => {
  console.log(`quorumReached `);

  let contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("quorumReached", contractFunctionParameters)
    .setGas(500000)
    .execute(client);
    
  await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const weight = record.contractFunctionResult!.getBool(0);

  console.log(`quorumReached ${weight}`);
}

const voteSucceeded = async (proposalId: BigNumber) => {
  console.log(`voteSucceeded `);

  let contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("voteSucceeded", contractFunctionParameters)
    .setGas(500000)
    .execute(client);
    
  await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const weight = record.contractFunctionResult!.getBool(0);

  console.log(`voteSucceeded ${weight}`);
}

const proposalVotes = async (proposalId: BigNumber) => {
  console.log(`proposalVotes `);

  let contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("proposalVotes", contractFunctionParameters)
    .setGas(500000)
    .execute(client);
    
  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const against = record.contractFunctionResult!.getInt256(0);
  const forVote = record.contractFunctionResult!.getInt256(1);
  const abstain = record.contractFunctionResult!.getInt256(2);

  console.log(`proposalVotes tx status ${receipt.status}`);

  console.log(`proposalVotes  against ${against}  forVote ${forVote}  abstain ${abstain}`);
}


const state = async (proposalId: BigNumber) => {
  console.log(`state `);

  let contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId);

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("state", contractFunctionParameters)
    .setGas(500000)
    .execute(client);
    
  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const state = record.contractFunctionResult!.getInt256(0);


  console.log(`state tx status ${receipt.status}`);

  console.log(`state  ${state} `);
}

async function main() {
    console.log(`Using governor proxy address ${contractId}`);
    //const tokenId = await createToken();
    const tokenId =  TokenId.fromString("0.0.48602743");
    //await initialize(tokenId);

    const targets = [htsServiceAddress];
    const ethFees = [0]; 
    const associateToken = await associateTokenPublicCallData(tokenId);
    const transferToken = await transferTokenPublicCallData(tokenId);
    const ts = await tokenSupply();
    const calls = [associateToken];
    const description = "Token transfer 1";

    //const proposalId = await propose(targets, ethFees, calls, description);
    // await vote(proposalId, 1);//1 is for vote. 
    // await quorumReached(proposalId);
    // await voteSucceeded(proposalId);
    // await proposalVotes(proposalId);
    // await state(proposalId);

    const pId = new BigNumber('7788464045664419436708497283330495880697462655886761242867983098820205810785');
    //await state(pId);
    //await new Promise(f => setTimeout(f, 12 * 1000));//Wait till waiting period is over. It's current deadline as per Governance. 
    await state(pId);//4 means succeeded
    await execute(targets, ethFees, calls, description);  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
