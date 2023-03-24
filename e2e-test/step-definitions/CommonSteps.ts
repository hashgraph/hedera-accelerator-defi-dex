import Governor from "../business/Governor";
import { Client } from "@hashgraph/sdk";
import GodHolder from "../business/GodHolder";

export class CommonSteps {
  public async cancelProposalInternally(
    governor: Governor,
    proposalId: string,
    client: Client,
    godHolder: GodHolder
  ) {
    try {
      const details = await governor.getProposalDetails(proposalId, client);
      await governor.cancelProposal(details.title, client);
      await godHolder.revertTokensForVoter(client);
    } catch (e: any) {
      console.log("Failed while cleaning up level - 1");
      console.log(e);
      try {
        await godHolder.revertTokensForVoterForcefully(client);
      } catch (e: any) {
        console.log("Failed while cleaning up level - 2");
        console.log(e);
      }
    }
  }
}
