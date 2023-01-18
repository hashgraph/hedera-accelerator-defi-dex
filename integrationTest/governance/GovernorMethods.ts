import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  TokenId,
} from "@hashgraph/sdk";

import dotenv from "dotenv";
import ClientManagement from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import dex from "../../deployment/model/dex";

dotenv.config();

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const client = clientManagement.createOperatorClient();
const { treasureKey } = clientManagement.getTreasure();

const adminClient = clientManagement.createClientAsAdmin();
const { adminKey } = clientManagement.getAdmin();

const treasurerClient = clientManagement.createClient();
const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;

export default class GovernorMethods {
  getCurrentImplementationFromProxy = async (proxyId: string) => {
    const tx = await new ContractExecuteTransaction()
      .setContractId(proxyId)
      .setGas(2000000)
      .setFunction("implementation", new ContractFunctionParameters())
      .freezeWith(adminClient)
      .sign(adminKey);
    const txResponse = await tx.execute(adminClient);
    const txRecord = await txResponse.getRecord(adminClient);
    const impAddress = txRecord.contractFunctionResult!.getAddress(0);
    console.log(`- current implementation/logic address: ${impAddress}`);
    return impAddress;
  };

  upgradeTo = async (proxyAddress: string, logicAddress: string) => {
    const proxyId = ContractId.fromSolidityAddress(proxyAddress).toString();
    await this.getCurrentImplementationFromProxy(proxyId);
    const args = new ContractFunctionParameters().addAddress(logicAddress);
    const txn = await new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(proxyAddress))
      .setGas(2000000)
      .setFunction("upgradeTo", args)
      .freezeWith(adminClient)
      .sign(adminKey);
    const txnResponse = await txn.execute(adminClient);
    const txnReceipt = await txnResponse.getReceipt(adminClient);
    console.log(`- upgradedTo txn status: ${txnReceipt.status}`);
    await this.getCurrentImplementationFromProxy(proxyId);
  };

  getContractAddresses = async (contractId: string, proposalId: BigNumber) => {
    const args = new ContractFunctionParameters().addUint256(proposalId);
    const txnResponse = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction("getContractAddresses", args)
      .execute(client);
    const record = await txnResponse.getRecord(client);
    const proxyAddress = record.contractFunctionResult!.getAddress(0);
    const logicAddress = record.contractFunctionResult!.getAddress(1);
    const proxyId = ContractId.fromSolidityAddress(proxyAddress);
    const logicId = ContractId.fromSolidityAddress(logicAddress);
    const proxyIdString = proxyId.toString();
    const logicIdString = logicId.toString();
    const response = {
      proxyId,
      proxyIdString,
      proxyAddress,
      logicId,
      logicIdString,
      logicAddress,
    };
    console.log(
      `- read proxy and new implementation/logic addresses from proposal: ${proxyAddress}, ${logicAddress}`
    );
    return response;
  };

  public vote = async (
    proposalId: BigNumber,
    voteId: number,
    contractId: string | ContractId
  ) => {
    console.log(`\nVote for proposal id ${proposalId} `);
    const contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId)
      .addUint8(voteId);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("castVote", contractFunctionParameters)
      .setGas(900000)
      .freezeWith(treasurerClient);

    const executedTx = await tx.execute(treasurerClient);

    const response = await executedTx.getRecord(client);
    const receipt = await executedTx.getReceipt(treasurerClient);

    const status = receipt.status;

    console.log(
      `Vote tx status ${status} for proposal id ${response.contractFunctionResult?.getUint256(
        0
      )}`
    );
  };

  public quorumReached = async (
    proposalId: BigNumber,
    contractId: string | ContractId
  ) => {
    console.log(`\nGetting quorumReached `);

    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("quorumReached", contractFunctionParameters)
      .setGas(500000)
      .execute(client);

    const receipt = await contractTokenTx.getReceipt(client);
    const record = await contractTokenTx.getRecord(client);
    const status = record.contractFunctionResult!.getBool(0);

    console.log(
      `quorumReached tx status ${receipt.status} with quorumReached ${status}`
    );
  };

  public initialize = async (contractId: string | ContractId) => {
    const tokenId = TokenId.fromString(dex.GOD_TOKEN_ID);
    console.log(`\nInitialize contract with token  `);
    const votingDelay = 0;
    const votingPeriod = 100; //Blocks to mint

    let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(tokenId.toSolidityAddress()) // token that define the voting weight, to vote user should have % of this token.
      .addUint256(votingDelay)
      .addUint256(votingPeriod)
      .addAddress(htsServiceAddress);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("initialize", contractFunctionParameters)
      .setGas(900000)
      .execute(client);

    const receipt = await tx.getReceipt(client);

    console.log(`Initialize contract with token done with status - ${receipt}`);
  };

  public voteSucceeded = async (
    proposalId: BigNumber,
    contractId: string | ContractId
  ) => {
    console.log(`\nvoteSucceeded `);

    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("voteSucceeded", contractFunctionParameters)
      .setGas(500000)
      .execute(client);

    const receipt = await contractTokenTx.getReceipt(client);
    const record = await contractTokenTx.getRecord(client);
    const status = record.contractFunctionResult!.getBool(0);

    console.log(
      `voteSucceeded tx status ${receipt.status} with status ${status}`
    );
  };

  public proposalVotes = async (
    proposalId: BigNumber,
    contractId: string | ContractId
  ) => {
    console.log(`\nGetting proposalVotes - `);

    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

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

    console.log(
      `proposalVotes tx status ${receipt.status}, Votes detail - against ${against}  forVote ${forVote}  abstain ${abstain}`
    );
  };

  public state = async (
    proposalId: BigNumber,
    contractId: string | ContractId
  ) => {
    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("state", contractFunctionParameters)
      .setGas(500000)
      .execute(client);

    const receipt = await contractTokenTx.getReceipt(client);
    const record = await contractTokenTx.getRecord(client);
    const state = record.contractFunctionResult!.getInt256(0);
    console.log(
      `- proposal state tx status: ${receipt.status}, state: ${state} `
    );
    return state;
  };

  public cancelProposal = async (
    title: string,
    contractId: string | ContractId
  ) => {
    console.log(`\nCancel proposal `);

    const contractFunctionParameters =
      new ContractFunctionParameters().addString(title);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("cancelProposal", contractFunctionParameters)
      .setGas(900000)
      .freezeWith(client)
      .sign(treasureKey);

    const executedTx = await tx.execute(client);

    const record = await executedTx.getRecord(client);
    const receipt = await executedTx.getReceipt(client);

    const status = receipt.status;
    const proposalId = record.contractFunctionResult?.getUint256(0)!;
    console.log(
      `Cancel Proposal tx status ${status} with proposal id ${proposalId}`
    );

    return proposalId;
  };

  public execute = async (title: string, contractId: string | ContractId) => {
    const contractFunctionParameters =
      new ContractFunctionParameters().addString(title);

    const contractAllotTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("executeProposal", contractFunctionParameters)
      .setPayableAmount(new Hbar(70))
      .setMaxTransactionFee(new Hbar(70))
      .setGas(900000)
      .freezeWith(client)
      .sign(treasureKey); //Admin of token

    const executedTx = await contractAllotTx.execute(client);
    const record = await executedTx.getRecord(client);
    const contractAllotRx = await executedTx.getReceipt(client);
    const status = contractAllotRx.status;
    const pId = record.contractFunctionResult?.getUint256(0);
    console.log(
      `- proposal execute tx status: ${status}, proposalId ${pId?.toFixed()}`
    );
    return status.toString() === "SUCCESS";
  };

  public getProposalDetails = async (
    proposalId: BigNumber,
    contractId: string | ContractId
  ) => {
    console.log(`\nGetting proposal details`);
    const args = new ContractFunctionParameters().addUint256(proposalId);
    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("getProposalDetails", args)
      .setGas(500000)
      .execute(client);
    const txReceipt = await tx.getReceipt(client);
    const txRecord = await tx.getRecord(client);
    const title = txRecord.contractFunctionResult!.getString(1);
    const description = txRecord.contractFunctionResult!.getString(2);
    const link = txRecord.contractFunctionResult!.getString(3);
    console.log(
      `Proposal details tx status ${txReceipt.status} with proposal id = ${proposalId}, title = ${title}, description = ${description} & link = ${link}`
    );
  };

  public createContractUpgradeProposal = async (
    contractId: ContractId,
    targetProxyId: ContractId,
    targetLogicId: ContractId,
    title: string,
    description: string,
    link: string
  ) => {
    const contractFunctionParameters = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(targetProxyId.toSolidityAddress())
      .addAddress(targetLogicId.toSolidityAddress());

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("createProposal", contractFunctionParameters)
      .setGas(9000000)
      .freezeWith(client)
      .sign(treasureKey);

    const txnResponse = await tx.execute(client);
    const txRecord = await txnResponse.getRecord(client);
    const txnReceipt = await txnResponse.getReceipt(client);
    const status = txnReceipt.status;
    const proposalId = txRecord.contractFunctionResult?.getUint256(0)!;
    return {
      proposalId,
      success: status.toString().toLowerCase() === "success",
    };
  };
}
