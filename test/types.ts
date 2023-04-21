import { BigNumber } from "ethers";

interface DAOCreatedEventLog {
  daoDetails: {
    daoAddress: string;
    admin: string;
    name: string;
    logoUrl: string;
    tokenAddress: string;
    votingRules: {
      quorumThreshold: BigNumber;
      votingDelay: BigNumber;
      votingPeriod: BigNumber;
    };
    isPrivate: boolean;
  };
}

export interface GovernanceDAOCreatedEventLog extends DAOCreatedEventLog {}
export interface NFTDAOCreatedEventLog extends DAOCreatedEventLog {}

export interface MultiSigDAOCreatedEventLog {
  daoAddress: string;
  safeAddress: string;
  admin: string;
  name: string;
  logoUrl: string;
  owners: string[];
  threshold: BigNumber;
  isPrivate: boolean;
}

export enum Events {
  GovernanceDAOCreated = "GovernanceDAOCreated",
  MultiSigDAOCreated = "MultiSigDAOCreated",
  NFTDAOCreated = "NFTDAOCreated",
}
