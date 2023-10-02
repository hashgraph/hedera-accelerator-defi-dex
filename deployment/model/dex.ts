import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";

const ZERO_TOKEN_ID = TokenId.fromString("0.0.0");

const GOD_TOKEN_ID = "0.0.80158";
const GOD_TOKEN_ADDRESS = "0x000000000000000000000000000000000001391e";

const NFT_TOKEN_ID = TokenId.fromString("0.0.2019043");

const E2E_NFT_TOKEN_ID = TokenId.fromString("0.0.2726474");

const HBARX_TOKEN_ID = "0.0.80165";
const HBARX_TOKEN_ADDRESS = "0x0000000000000000000000000000000000013925";

const TOKEN_LAB49_1 = "0.0.80170";
const TOKEN_LAB49_1_ID = TokenId.fromString(TOKEN_LAB49_1);
const LAB49_1_TOKEN_ADDRESS = TOKEN_LAB49_1_ID.toSolidityAddress();

const TOKEN_LAB49_2 = "0.0.80174";
const LAB49_2_TOKEN_ADDRESS = "0x000000000000000000000000000000000001392e";

const TOKEN_LAB49_3 = "0.0.80180";
const LAB49_3_TOKEN_ADDRESS = "0x0000000000000000000000000000000000013934";

const GOVERNANCE_DAO_ONE = "GOVERNANCE-DAO-ONE";
const GOVERNANCE_DAO_ONE_TOKEN_ID = TokenId.fromString("0.0.80183");

const GOVERNANCE_DAO_TWO = "GOVERNANCE-DAO-TWO";
const GOVERNANCE_DAO_TWO_TOKEN_ID = TokenId.fromString("0.0.80188");

const MULTI_SIG_DAO_ONE = "MULTI_SIG_DAO_ONE";

const DAO_FEE = 1;

const ROLES = {
  DAO_ADMIN: Helper.role("DAO_ADMIN"),
  DEFAULT_ADMIN_ROLE: new Uint8Array(), // it is zero inside contract i.e 0x00
  CHILD_PROXY_ADMIN_ROLE: Helper.role("CHILD_PROXY_ADMIN_ROLE"),
};

const ACCOUNTS = [
  {
    id: "0.0.60461",
    key: "302e020100300506032b657004220420c372f05c182ae62e04603081f6abc8cbd3a712401e1d1f88401cf310c91f644b",
  },
  {
    id: "0.0.122857",
    key: "3030020100300706052b8104000a042204202bf0fd85822d23c5924ee13e2d2cdca215777e15cd5c7f3f0f16f67fdc2b1ca7",
  },
  {
    id: "0.0.78567",
    key: "302e020100300506032b6570042204200bf5b9ac3f3066f6046a778409891e9f2081c349b4cf8688d29023312cc2d632",
  },
  {
    id: "0.0.65816",
    key: "302e020100300506032b657004220420899ec4fb7e8153a36bd37dd9500b9057982bf76bc1f0efa5b8cb170ee2329997",
  },
  {
    id: "0.0.78619",
    key: "302e020100300506032b657004220420c8cb72a0addffcbd898689e5b5641c0abff4399ddeb90a04071433e3724e14dd",
  },
  {
    id: "0.0.78391",
    key: "302e020100300506032b65700422042014138f9d2fbcc9969d9efe28b7fc5281995587c2587ed62d19b78058241dd838",
  },
  {
    id: "0.0.114910",
    key: "302e020100300506032b6570042204204f28140b19a330b04f173fcc5f63b0282ce80e6f4e5dc893b70fd9686c9e1c38",
  },
  {
    id: "0.0.114676",
    key: "302e020100300506032b657004220420c9874f71ab8d3efe30684175d6b5bc54bae9a8a69ecb3e01dfa8e47578ac5447",
  },
  {
    id: "0.0.405576",
    key: "302e020100300506032b6570042204202cc790b009e400a3ed97363980ae27ddfb58102fa8fb7c1a7b69e212f756c084",
  },
  {
    id: "0.0.405652",
    key: "302e020100300506032b6570042204208e8fe8f694707f2e578f5ced24304a5190b59ef014a0b978d9db0732eaf6445d",
  },
];

export default {
  GOD_TOKEN_ID,
  GOD_TOKEN_ADDRESS,
  NFT_TOKEN_ID,
  HBARX_TOKEN_ID,
  HBARX_TOKEN_ADDRESS,
  TOKEN_LAB49_1,
  LAB49_1_TOKEN_ADDRESS,
  TOKEN_LAB49_2,
  LAB49_2_TOKEN_ADDRESS,
  TOKEN_LAB49_3,
  LAB49_3_TOKEN_ADDRESS,
  GOVERNANCE_DAO_ONE,
  GOVERNANCE_DAO_ONE_TOKEN_ID,
  GOVERNANCE_DAO_TWO,
  GOVERNANCE_DAO_TWO_TOKEN_ID,
  MULTI_SIG_DAO_ONE,
  E2E_NFT_TOKEN_ID,
  TOKEN_LAB49_1_ID,
  ROLES,
  ACCOUNTS,
  ZERO_TOKEN_ID,
  DAO_FEE,
};
