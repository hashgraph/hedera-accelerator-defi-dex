import {
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenId,
  Client,
  AccountId,
  PrivateKey,
  Hbar,
} from "@hashgraph/sdk";

import { BigNumber } from "bignumber.js";
import { ContractService } from "../../deployment/service/ContractService";
import ClientManagement from "../../utils/ClientManagement";
import { Helper } from "../../utils/Helper";
import dex from "../../deployment/model/dex";

export default class Governor {
  public initialize = async (
    contractId: string | ContractId,
    htsServiceAddress: string,
    godHolderProxyAdd: string,
    defaultQuorumThresholdValue: number,
    client: Client,
    votingDelay: number,
    votingPeriod: number
  ) => {
    const tokenId = TokenId.fromString(dex.GOD_TOKEN_ID);
    console.log(`\nInitialize contract with token  `);
    let contractFunctionParameters = new ContractFunctionParameters()
      .addAddress(tokenId.toSolidityAddress()) // token that define the voting weight, to vote user should have % of this token.
      .addUint256(votingDelay)
      .addUint256(votingPeriod)
      .addAddress(htsServiceAddress)
      .addAddress(godHolderProxyAdd)
      .addUint256(defaultQuorumThresholdValue)
      .addBool(true);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("initialize", contractFunctionParameters)
      .setGas(900000)
      .execute(client);

    const receipt = await tx.getReceipt(client);

    console.log(
      `Initialize contract with token done with status - ${receipt.status}`
    );
  };

  public propose = async (
    contractId: string | ContractId,
    title: string,
    description: string,
    link: string,
    fromAddress: string,
    toAddress: string,
    transferTokenId: string,
    client: Client,
    treasureKey: PrivateKey,
    tokenAmount: BigNumber
  ) => {
    console.log(`\nCreating proposal `);
    const args = new ContractFunctionParameters()
      .addString(title)
      .addString(description)
      .addString(link)
      .addAddress(fromAddress) // from
      .addAddress(toAddress) // to
      .addAddress(transferTokenId) // tokenToTransfer
      .addInt256(tokenAmount); // amountToTransfer

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("createProposal", args)
      .setGas(9000000)
      .freezeWith(client)
      .sign(treasureKey);

    const txResponse = await tx.execute(client);
    const txRecord = await txResponse.getRecord(client);
    const txReceipt = await txResponse.getReceipt(client);
    const status = txReceipt.status;
    const proposalId = txRecord.contractFunctionResult!.getUint256(0);
    console.log(`Proposal tx status ${status} with proposal id ${proposalId}`);
    return proposalId;
  };

  public vote = async (
    proposalId: BigNumber,
    voteId: number,
    contractId: string | ContractId,
    client: Client
  ) => {
    console.log(`\nVote for proposal id ${proposalId} `);
    const contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId)
      .addUint8(voteId);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("castVote", contractFunctionParameters)
      .setGas(9900000);

    const executedTx = await tx.execute(client);

    const response = await executedTx.getRecord(client);
    const receipt = await executedTx.getReceipt(client);

    const status = receipt.status;

    console.log(
      `Vote tx status ${status} for proposal id ${response.contractFunctionResult?.getUint256(
        0
      )}`
    );
  };

  public quorumReached = async (
    proposalId: BigNumber,
    contractId: string | ContractId,
    client: Client
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

  public voteSucceeded = async (
    proposalId: BigNumber,
    contractId: string | ContractId,
    client: Client
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
    contractId: string | ContractId,
    client: Client
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
    contractId: string | ContractId,
    client: Client
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

  public execute = async (
    title: string,
    contractId: string | ContractId,
    client: Client,
    treasureKey: PrivateKey
  ) => {
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

  public cancelProposal = async (
    title: string,
    contractId: string | ContractId,
    client: Client,
    treasureKey: PrivateKey
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

  revertGod = async (client: Client, contractId: string | ContractId) => {
    console.log(`revertGod`);
    const args = new ContractFunctionParameters();
    const txn = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(9000000)
      .setFunction("revertTokensForVoter", args)
      .freezeWith(client);
    const txnResponse = await txn.execute(client);
    const txnRecord = await txnResponse.getRecord(client);
    const txnResult = txnRecord.contractFunctionResult!.getUint256(0);
    console.log(`revertGod txn result: ${txnResult}`);
    const txnReceipt = await txnResponse.getReceipt(client);
    console.log(`revertGod txn status: ${txnReceipt.status}`);
  };
}
