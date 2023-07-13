import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

import { Helper } from "../../utils/Helper";

async function main() {
  const systemBasedControl = new SystemRoleBasedAccess();
  await systemBasedControl.initialize();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
