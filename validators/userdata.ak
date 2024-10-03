use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/primitive/string
use cardano/transaction.{OutputReference, Transaction}

pub type UserDatum {
  twitter_username: String,
  discord_username: String,
  eth_username: String,
  owner: VerificationKeyHash,
}

pub type Redeemer {
  msg: ByteArray,
}

validator user_data_manager {
  spend(
    datum: Option<UserDatum>,
    redeemer: Redeemer,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    trace @"redeemer": string.from_bytearray(redeemer.msg)

    expect Some(UserDatum { twitter_username, discord_username, eth_username, owner }) = datum

    let is_valid_command = redeemer.msg == string.to_bytearray("Update") || redeemer.msg == string.to_bytearray("Delete")
    let must_be_signed = list.has(self.extra_signatories, owner)

    is_valid_command? && must_be_signed?
  }
}

// Example test case
test user_data_example() {
  let datum =
    UserDatum {
      twitter_username: "Alfset", 
      discord_username: "discordUser#1234",
      username: "Alf", 
      owner: "00000000000000000000000000000000000000000000000000000000" 
    }

  let redeemer =
    Redeemer { msg: string.to_bytearray("Update") }

  let placeholder_utxo =
    OutputReference { transaction_id: "", output_index: 0 }

  user_data_manager.spend(
    Some(datum),
    redeemer,
    placeholder_utxo,
    Transaction {
      ..transaction.placeholder,
      extra_signatories: [datum.owner]
    }
  )
}
