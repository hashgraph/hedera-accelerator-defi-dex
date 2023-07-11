import { Helper } from "../../utils/Helper";
import { ContractService } from "../service/ContractService";

export async function main() {
  const csDev = new ContractService();
  csDev.makeLatestDeploymentAsDefault();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
