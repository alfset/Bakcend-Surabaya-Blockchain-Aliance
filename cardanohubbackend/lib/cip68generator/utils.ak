use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, ScriptHash}
use aiken/primitive/bytearray
use cardano/address.{Address}
use cardano/assets.{PolicyId, AssetName, flatten, lovelace_of, without_lovelace}
use cardano/transaction.{Transaction, Input, Output, InlineDatum}
use cip68generator/types.{Burn, Mint, MintRedeemer}
use types/cip68.{CIP68, get_url, get_event_name, get_image, get_date, get_author}

// @function: Checks if an output UTxO contains a valid event NFT reference
// Verifies that the output has an inline datum with CIP-68 event metadata (URL, name, image, date, author),
// the author matches the issuer, the author’s signature is present in extra_signatories, and it contains exactly one asset.
pub fn check_output_utxo(
  output: Output,
  issuer: VerificationKeyHash,
  extra_signatories: List<VerificationKeyHash>,
) -> Bool {
  expect InlineDatum(data) = output.datum
  expect metadatum: CIP68 = data
  let author = get_author(metadatum)
  let assets = assets.flatten(without_lovelace(output.value))
  let author_signed =
    when list.find(extra_signatories, fn(vk) { vk == author }) is {
      Some(_) -> True
      None -> False
    }
  and {
    author == issuer,
    author_signed,
    list.length(assets) == 1,
    bytearray.length(get_url(metadatum)) > 0,
    bytearray.length(get_event_name(metadatum)) > 0,
    bytearray.length(get_image(metadatum)) > 0,
    bytearray.length(get_date(metadatum)) > 0
  }
}

// @function: Finds an output UTxO with at least a specified amount of lovelace and a given address
// Searches the list of outputs for one that has at least the specified lovelace amount and matches the provided address.
pub fn find_output(
  outputs: List<Output>,
  price: Int,
  address: Address,
) -> Option<Output> {
  list.find(
    outputs,
    fn(output) {
      lovelace_of(output.value) >= price && output.address.payment_credential == address.payment_credential
    },
  )
}

// @function: Verifies the transaction outputs meet platform fee and user address conditions
// Ensures there are exactly two outputs: one with at least the platform fee sent to the platform address,
// and one to the user address, as part of minting/burning requirements.
pub fn check_output_remove(
  outputs: List<Output>,
  platform_address: Address,
  platform_fee: Int,
  user_address: Address,
) -> Bool {
  let outputs =
    list.filter(
      outputs,
      fn(output) {
        or {
          and {
            lovelace_of(output.value) >= platform_fee,
            output.address.payment_credential == platform_address.payment_credential,
          },
          output.address.payment_credential == user_address.payment_credential,
        }
      },
    )
  list.length(outputs) == 2
}

// @function: Checks if the number of UTxOs at a given address remains unchanged
// Compares the number of input UTxOs and output UTxOs at the specified address to ensure no net change,
// typically used to verify balance preservation in transactions.
pub fn check_output_update(
  inputs: List<Input>,
  outputs: List<Output>,
  address: Address,
) -> Bool {
  let utxo_outputs =
    list.filter(outputs, fn(output) { output.address == address })
  let utxo_inputs =
    list.filter(inputs, fn(input) { input.output.address == address })
  list.length(utxo_outputs) == list.length(utxo_inputs)
}

// @function: Pairs reference and user assets from a flattened asset list based on prefixes
// Filters and pairs assets with CIP-68 prefixes (100 for reference, 222 for user), sorting and zipping them
// to create a list of tuples containing policy ID, reference name, user name, and combined amount.
pub fn filter_and_pair(
  flat: List<(PolicyId, AssetName, Int)>,
  prefix100: ByteArray,
  prefix222: ByteArray,
) -> List<(PolicyId, AssetName, AssetName, Int)> {
  let filter100 =
    list.filter(
      flat,
      fn((_policy_id, asset_name, _amount)) {
        bytearray.starts_with(asset_name, prefix100)
      },
    )
  let filter222 =
    list.filter(
      flat,
      fn((_policy_id, asset_name, _amount)) {
        bytearray.starts_with(asset_name, prefix222)
      },
    )
  let asset_names_amounts100 =
    list.map(
      filter100,
      fn((policy_id, asset_name, amount)) { (policy_id, asset_name, amount) },
    )
  let asset_names_amounts222 =
    list.map(
      filter222,
      fn((policy_id, asset_name, amount)) { (policy_id, asset_name, amount) },
    )
  let sorted100 =
    list.sort(
      asset_names_amounts100,
      fn((_, name1, _), (_, name2, _)) { bytearray.compare(name1, name2) },
    )
  let sorted222 =
    list.sort(
      asset_names_amounts222,
      fn((_, name1, _), (_, name2, _)) { bytearray.compare(name1, name2) },
    )
  let paired = list.zip(sorted100, sorted222)
  list.map(
    paired,
    fn(((policy_id1, name1, amount1), (_policy_id2, name2, amount2))) {
      (policy_id1, name1, name2, amount1 + amount2)
    },
  )
}

// @function: Verifies assets with a specific prefix are burned correctly
// Checks that assets with the given prefix under a policy ID are burned (negative amounts) and match
// the expected total and individual asset amounts using by_prefix and exact helpers.
pub fn check_assets_prefix(
  flatten: List<(PolicyId, AssetName, Int)>,
  policy_id: PolicyId,
  prefix: ByteArray,
) -> Bool {
  let filtered =
    list.filter(
      flatten,
      fn((_policy_id, asset_name, _amount)) {
        bytearray.starts_with(asset_name, prefix)
      },
    )
  let pairs =
    list.map(
      filtered,
      fn((_policy_id, asset_name, amount)) { (asset_name, -amount) },
    )
  list.foldl(
    pairs,
    True,
    fn((asset_name, amount), acc) {
      if !acc {
        False
      } else {
        and {
          by_prefix(flatten, policy_id, cip68.prefix_222, -amount),
          exact(flatten, policy_id, asset_name, -amount),
        }
      }
    },
  )
}

// @function: Finds reference event assets in transaction inputs signed by their author
// Searches inputs for UTxOs with CIP-68 event metadata, verifies the author’s signature, and returns a list
// of reference assets (policy ID, name, amount) with the "100" prefix.
pub fn find_input_reference_asset(
  inputs: List<Input>,
  extra_signatories: List<VerificationKeyHash>,
) -> List<(PolicyId, AssetName, Int)> {
  list.filter_map(
    inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect metadatum: CIP68 = data
          let author = get_author(metadatum)
          let author_signed =
            when list.find(extra_signatories, fn(vk) { vk == author }) is {
              Some(_) -> True
              None -> False
            }
          if author_signed {
            let reference_asset = flatten(without_lovelace(input.output.value))
            let exist =
              list.find(
                reference_asset,
                fn((_policy_id, asset_name, _amount)) {
                  bytearray.starts_with(asset_name, cip68.prefix_100)
                },
              )
            when exist is {
              Some((policy_id, asset_name, amount)) ->
                Some((policy_id, asset_name, amount))
              None -> None
            }
          } else {
            None
          }
        }
        _ -> None
      }
    },
  )
}

// @function: Validates the minting of CIP-68 event NFTs
// Ensures that for each minted event NFT pair, the reference token is sent to the store address with valid
// metadata (URL, name, image, date), the issuer’s signature is valid, names match, and amounts are correct.
pub fn check_asset_mint(
  flatten: List<(PolicyId, AssetName, Int)>,
  policy_id: PolicyId,
  prefix100: ByteArray,
  prefix222: ByteArray,
  outputs: List<Output>,
  store_address: Address,
  issuer: VerificationKeyHash,
  extra_signatories: List<VerificationKeyHash>,
  has_reference: Bool,
) -> Bool {
  let pairs = filter_and_pair(flatten, prefix100, prefix222)
  list.foldl(
    pairs,
    True,
    fn((_policy_id, reference_asset_name, user_asset_name, amount), acc) {
      if !acc {
        False
      } else {
        let reference_value = [(policy_id, reference_asset_name, 1)]
        let output_utxo_store =
          list.find(
            outputs,
            fn(output) {
              output.address == store_address &&
              when list.find(
                assets.flatten(without_lovelace(output.value)),
                fn((pid, name, amt)) { pid == policy_id && name == reference_asset_name && amt == 1 }
              ) is {
                Some(_) -> True
                None -> False
              }
            },
          )
        when output_utxo_store is {
          Some(utxo) -> {
            and {
              check_output_utxo(utxo, issuer, extra_signatories),
              check_pair_asset_name(reference_asset_name, user_asset_name),
              check_minting_reference(
                flatten,
                policy_id,
                reference_asset_name,
                has_reference,
              ),
              exact(flatten, policy_id, user_asset_name, amount - 1),
              by_prefix(flatten, policy_id, cip68.prefix_222, amount - 1),
            }
          }
          None -> False
        }
      }
    },
  )
}

// @function: Validates the burning of CIP-68 event NFTs
// Ensures that for each burned event NFT pair, the reference and user tokens are burned correctly (amounts -1 and amount+1)
// and the prefix totals match the expected burn amounts.
pub fn check_asset_burn(
  flatten: List<(PolicyId, AssetName, Int)>,
  policy_id: PolicyId,
  prefix100: ByteArray,
  prefix222: ByteArray,
) -> Bool {
  let pairs = filter_and_pair(flatten, prefix100, prefix222)
  list.foldl(
    pairs,
    True,
    fn((_policy_id, reference_asset_name, user_asset_name, amount), acc) {
      if !acc {
        False
      } else {
        and {
          check_pair_asset_name(reference_asset_name, user_asset_name),
          exact(flatten, policy_id, reference_asset_name, -1),
          exact(flatten, policy_id, user_asset_name, amount + 1),
          by_prefix(flatten, policy_id, cip68.prefix_100, -1),
          by_prefix(flatten, policy_id, cip68.prefix_222, amount + 1),
        }
      }
    },
  )
}

// @function: Checks if a reference event asset is minted correctly based on its presence
// Verifies that if no reference asset exists (has_reference is False), it’s minted with amount 1 and the
// prefix "100" total is 1; otherwise, no additional minting check is needed.
pub fn check_minting_reference(
  flatten: List<(PolicyId, AssetName, Int)>,
  policy_id: PolicyId,
  reference_asset_name: AssetName,
  has_reference: Bool,
) -> Bool {
  if has_reference {
    True
  } else {
    and {
      exact(flatten, policy_id, reference_asset_name, 1),
      by_prefix(flatten, policy_id, cip68.prefix_100, 1),
    }
  }
}

// @function: Compares reference and user asset names after dropping prefixes
// Ensures the reference and user asset names match after removing the first 4 bytes (prefixes), per CIP-68 naming rules.
pub fn check_pair_asset_name(
  reference_asset_name: AssetName,
  user_asset_name: AssetName,
) -> Bool {
  bytearray.compare(
    bytearray.drop(reference_asset_name, 4),
    bytearray.drop(user_asset_name, 4),
  ) == Equal
}

// @function: Checks if event assets can be removed from inputs
// Verifies that at least one input has CIP-68 event metadata with an author signature present in extra_signatories,
// returning a flattened list of assets if valid.
pub fn check_remove_asset(
  inputs: List<Input>,
  extra_signatories: List<VerificationKeyHash>,
) -> Bool {
  let flatten =
    list.filter_map(
      inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect metadatum: CIP68 = data
            let author = get_author(metadatum)
            let author_signed =
              when list.find(extra_signatories, fn(vk) { vk == author }) is {
                Some(_) -> True
                None -> False
              }
            if author_signed {
              let assets = flatten(without_lovelace(input.output.value))
              Some(assets)
            } else {
              None
            }
          }
          _ -> None
        }
      },
    )
  list.length(flatten) > 0
}

// @function: Verifies the total amount of assets with a prefix matches an expected value
// Checks that the sum of amounts for assets with a given prefix under a policy ID equals the expected amount.
pub fn by_prefix(
  flatten: List<(PolicyId, AssetName, Int)>,
  policy_id: PolicyId,
  prefix: ByteArray,
  expected_amount: Int,
) -> Bool {
  let filtered =
    list.filter(
      flatten,
      fn((pid, asset_name, _amount)) {
        pid == policy_id && bytearray.starts_with(asset_name, prefix)
      },
    )
  let total_amount =
    list.foldl(
      filtered,
      0,
      fn((_, _, amount), acc) { acc + amount },
    )
  total_amount == expected_amount
}

// @function: Checks if an exact asset has the specified mint/burn amount
// Verifies that a specific asset (by policy ID and name) has the exact amount in the flattened list,
// returning True if not found and expecting 0 (no mint/burn).
pub fn exact(
  flatten: List<(PolicyId, AssetName, Int)>,
  policy_id: PolicyId,
  asset_name: AssetName,
  expected_amount: Int,
) -> Bool {
  let found =
    list.find(
      flatten,
      fn((pid, name, _amount)) { pid == policy_id && name == asset_name },
    )
  when found is {
    Some((_, _, amount)) -> amount == expected_amount
    None -> expected_amount == 0
  }
}