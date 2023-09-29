export interface VotingPeriodInfo {
  createdAt: string;
  voteStart: string;
  voteEnd: string;
  currentTime: string;
  votingPeriod: number;
  votingDelay: number;
  isVotingStarted: boolean;
  isVotingEnded: boolean;
  votingStartsIn: number;
  votingEndsIn: number;
}
