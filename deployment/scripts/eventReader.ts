import { Helper } from "../../utils/Helper";
import { MirrorNodeService } from "../../utils/MirrorNodeService";

export async function main(_contractId: string | null = null) {
  const contractId =
    _contractId ??
    process.env.CONTRACT_ID ??
    (await Helper.readContractIdFromPrompt());
  return await MirrorNodeService.getInstance()
    .enableLogs()
    .getEvents(contractId);
}

if (require.main === module) {
  main()
    .catch(console.error)
    .finally(() => {
      process.exit(1);
    });
}
