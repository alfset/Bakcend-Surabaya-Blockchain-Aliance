use aiken/collection/list
use cardano/address.{Address}
use cardano/assets.{PolicyId, without_lovelace}
use cardano/transaction.{Transaction, Input, Output, InlineDatum, Value}
use cip68generator/utils.{check_output_remove, check_output_update, check_asset_mint, check_asset_burn, find_input_reference_asset}
use cip68generator/types.{MintRedeemer}
use types/cip68.{CIP68}
use aiken/primitive/bytearray.{encode_utf8}

// @function: Validates a transaction for creating or burning event NFTs as CIP-68 assets
// Validates whether the transaction correctly mints or burns CIP-68 event tokens/NFTs by checking platform fees,
// event metadata (URL, name, image, date) during minting, and output updates based on the redeemer (Mint or Burn).
pub fn validate(
  redeemer: MintRedeemer,
  platform_address: Address,
  platform_fee: Int,
  store_address: Address,
  user_address: Address,
  issuer: VerificationKeyHash,
  policy_id: PolicyId,
  tx: Transaction,
) -> Bool {
  let Transaction { inputs, outputs, extra_signatories, mint, .. } = tx
  let mint_flatten =
    without_lovelace(mint)
  when redeemer is {
    Mint -> {
      let reference_assets = find_input_reference_asset(inputs, extra_signatories)
      let has_reference = list.length(reference_assets) > 0
      let flatten = if has_reference {
        list.concat(reference_assets, mint_flatten)
      } else {
        mint_flatten
      }
      and {
        check_output_remove(outputs, platform_address, platform_fee, user_address),
        check_asset_mint(
          flatten,
          policy_id,
          cip68.prefix_100,
          cip68.prefix_222,
          outputs,
          store_address,
          issuer,
          extra_signatories,
          has_reference,
        ),
        check_output_update(inputs, outputs, user_address),
      }
    }
    Burn -> { 
      and {
        check_output_remove(outputs, platform_address, platform_fee, user_address),
        check_asset_burn(mint_flatten, policy_id, cip68.prefix_100, cip68.prefix_222),
        check_output_update(inputs, outputs, user_address),
      }
    }
  }
}

// Test: Successfully mint an event NFT with valid metadata
test mint_event_nft_success() {
  let issuer: VerificationKeyHash = #[0x01] 
  let policy_id: PolicyId = #[0x04, 0x05, 0x06]  
  let platform_address = Address { payment_credential: ScriptHash(#[0x07, 0x08, 0x09]), stake_credential: None }
  let store_address = Address { payment_credential: ScriptHash(#[0x0a, 0x0b, 0x0c]), stake_credential: None }
  let user_address = Address { payment_credential: ScriptHash(#[0x0d, 0x0e, 0x07f]), stake_credential: None }
  let platform_fee = 2000000

  // Minted assets: reference token (prefix "100") and user token (prefix "222")
  let ref_asset_name = bytearray.concat(cip68.prefix_100, encode_utf8("event1"))
  let user_asset_name = bytearray.concat(cip68.prefix_222, encode_utf8("event1"))
  let mint = Value([
    (PolicyId(policy_id), [
      (AssetName(ref_asset_name), 1),
      (AssetName(user_asset_name), 1)
    ])
  ])

  // Transaction outputs
  let outputs = [
    Output {
      address: platform_address,
      value: Value([(PolicyId(#[]), [(AssetName(#[]), platform_fee)])]), 
      datum: None
    },
    Output {
      address: store_address,
      value: Value([(PolicyId(policy_id), [(AssetName(ref_asset_name), 1)])]),
      datum: Some(InlineDatum(CIP68 {
        url: encode_utf8("https://example.com/event"),
        event_name: encode_utf8("Concert 2025"),
        image: encode_utf8("https://example.com/image.jpg"),
        date: encode_utf8("2025-03-01"),
        author: issuer
      }))
    },
    Output {
      address: user_address,
      value: Value([(PolicyId(policy_id), [(AssetName(user_asset_name), 1)])]), 
      datum: None
    }
  ]

  // Transaction with no inputs (simplified for test)
  let tx = Transaction {
    inputs: [],
    outputs: outputs,
    extra_signatories: [issuer],
    mint: mint,
    fee: 0,
    ttl: None,
    certificates: [],
    withdrawals: [],
    auxiliary_data: None,
    validity_start: None,
    witnesses: []
  }

  validate(
    Mint,
    platform_address,
    platform_fee,
    store_address,
    user_address,
    issuer,
    PolicyId(policy_id),
    tx
  ) == True
}

// Test: Fail minting an event NFT with missing metadata (empty URL)
test mint_event_nft_missing_url() {
  let issuer: VerificationKeyHash = #[0x01]  
  let policy_id: PolicyId = #[0x04, 0x05, 0x06]  
  let platform_address = Address { payment_credential: ScriptHash(#[0x07, 0x08, 0x09]), stake_credential: None }
  let store_address = Address { payment_credential: ScriptHash(#[0x0a, 0x0b, 0x0c]), stake_credential: None }
  let user_address = Address { payment_credential: ScriptHash(#[0x0d, 0x0e, 0x0f]), stake_credential: None }
  let platform_fee = 2000000

  let ref_asset_name = bytearray.concat(cip68.prefix_100, encode_utf8("event2"))
  let user_asset_name = bytearray.concat(cip68.prefix_222, encode_utf8("event2"))
  let mint = Value([
    (PolicyId(policy_id), [
      (AssetName(ref_asset_name), 1),
      (AssetName(user_asset_name), 1)
    ])
  ])

  let outputs = [
    Output {
      address: platform_address,
      value: Value([(PolicyId(#[]), [(AssetName(#[]), platform_fee)])]),
      datum: None
    },
    Output {
      address: store_address,
      value: Value([(PolicyId(policy_id), [(AssetName(ref_asset_name), 1)])]),
      datum: Some(InlineDatum(CIP68 {
        url: #[], // Empty URL should fail
        event_name: encode_utf8("Concert 2025"),
        image: encode_utf8("https://example.com/image.jpg"),
        date: encode_utf8("2025-03-01"),
        author: issuer
      }))
    },
    Output {
      address: user_address,
      value: Value([(PolicyId(policy_id), [(AssetName(user_asset_name), 1)])]),
      datum: None
    }
  ]

  let tx = Transaction {
    inputs: [],
    outputs: outputs,
    extra_signatories: [issuer],
    mint: mint,
    fee: 0,
    ttl: None,
    certificates: [],
    withdrawals: [],
    auxiliary_data: None,
    validity_start: None,
    witnesses: []
  }

  validate(
    Mint,
    platform_address,
    platform_fee,
    store_address,
    user_address,
    issuer,
    PolicyId(policy_id),
    tx
  ) == False
}

// Test: Fail minting an event NFT with incorrect issuer signature
test mint_event_nft_wrong_signature() {
  let issuer: VerificationKeyHash = #[0x01]  
  let policy_id: PolicyId = #[0x04, 0x05, 0x06]  
    let wrong_signer: VerificationKeyHash = #[0x00ff] 
  let platform_address = Address { payment_credential: ScriptHash(#[0x07, 0x08, 0x09]), stake_credential: None }
  let store_address = Address { payment_credential: ScriptHash(#[0x0a, 0x0b, 0x0c]), stake_credential: None }
  let user_address = Address { payment_credential: ScriptHash(#[0x0d, 0x0e, 0x0f]), stake_credential: None }
  let platform_fee = 2000000

  let ref_asset_name = bytearray.concat(cip68.prefix_100, encode_utf8("event3"))
  let user_asset_name = bytearray.concat(cip68.prefix_222, encode_utf8("event3"))
  let mint = Value([
    (PolicyId(policy_id), [
      (AssetName(ref_asset_name), 1),
      (AssetName(user_asset_name), 1)
    ])
  ])

  let outputs = [
    Output {
      address: platform_address,
      value: Value([(PolicyId(#[]), [(AssetName(#[]), platform_fee)])]),
      datum: None
    },
    Output {
      address: store_address,
      value: Value([(PolicyId(policy_id), [(AssetName(ref_asset_name), 1)])]),
      datum: Some(InlineDatum(CIP68 {
        url: encode_utf8("https://example.com/event"),
        event_name: encode_utf8("Concert 2025"),
        image: encode_utf8("https://example.com/image.jpg"),
        date: encode_utf8("2025-03-01"),
        author: issuer
      }))
    },
    Output {
      address: user_address,
      value: Value([(PolicyId(policy_id), [(AssetName(user_asset_name), 1)])]),
      datum: None
    }
  ]

  let tx = Transaction {
    inputs: [],
    outputs: outputs,
    extra_signatories: [wrong_signer],
    mint: mint,
    fee: 0,
    ttl: None,
    certificates: [],
    withdrawals: [],
    auxiliary_data: None,
    validity_start: None,
    witnesses: []
  }

  validate(
    Mint,
    platform_address,
    platform_fee,
    store_address,
    user_address,
    issuer,
    PolicyId(policy_id),
    tx
  ) == False
}
