const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  AccountBalanceQuery,
  Hbar,
} = require("@hashgraph/sdk");
require("dotenv").config();

async function environmentSetup() {
  // Grab your Hedera testnet account ID and private key from your .env file
  const myAccountId = process.env.MY_ACCOUNT_ID;
  const myPrivateKey = process.env.MY_PRIVATE_KEY;

  // If we weren't able to grab it, we should throw a new error
  if (myAccountId == null || myPrivateKey == null) {
    throw new Error(
      "Environment variables myAccountId and myPrivateKey must be present"
    );
  }

  // Create your connection to the Hedera Network
  const client = Client.forTestnet();
  client.setOperator(myAccountId, myPrivateKey);

  //Set the default maximum transaction fee (in Hbar)
  client.setDefaultMaxTransactionFee(new Hbar(100));

  //Set the maximum payment for queries (in Hbar)
  client.setMaxQueryPayment(new Hbar(50));

  // Create new keys
  const newAccountPrivateKey = PrivateKey.generateED25519();
  const newAccountPublicKey = newAccountPrivateKey.publicKey;

  // Create a new account with 1,000 tinybar starting balance
  const newAccount = await new AccountCreateTransaction()
    .setKey(newAccountPublicKey)
    .setInitialBalance(Hbar.from(2000))
    .execute(client);

  // Get the new account ID
  const getReceipt = await newAccount.getReceipt(client);
  const newAccountId = getReceipt.accountId;

  console.log("\nNew account ID: " + newAccountId);
  console.log("\nNew newAccountPrivateKey: " + newAccountPrivateKey);

  // Verify the account balance
  const accountBalance = await new AccountBalanceQuery()
    .setAccountId(newAccountId)
    .execute(client);

  console.log(
    "The new account balance is: " +
      accountBalance.hbars.toTinybars() +
      " bars."
  );

  return newAccountId;
}
environmentSetup();
