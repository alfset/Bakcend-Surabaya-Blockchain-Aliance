use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address, Credential, Script, VerificationKey}
use cardano/assets.{AssetName, PolicyId, flatten, lovelace_of, quantity_of}
use cardano/transaction.{InlineDatum, Output, OutputReference, Transaction, find_input}

// Datum for the airdrop contract storing relevant info
pub type AirdropDatum {
  creator: VerificationKeyHash,
  policy_id: PolicyId,
  asset_name: AssetName,
  amount: Int,
  claimed: Int,
  tag: Option<OutputReference>,
  claimants: List<(Address, Int)>,
}

pub type AirdropRedeemer {
  Claim(VerificationKeyHash)
  Close
  AddRewards
}

pub fn is_signed_by(
  extra_signatories: List<VerificationKeyHash>,
  verification_key: Credential,
) {
  expect VerificationKey(vk) = verification_key
  list.has(extra_signatories, vk)
}

/// Main validator for the airdrop contract
///
/// Verifies actions based on the redeemer:
/// - Claim: claim tokens by a registered claimant
/// - Close: creator closes the airdrop and takes remaining tokens
/// - AddRewards: creator adds reward tokens to the contract
validator airdrop {
  spend(
    datum: Option<AirdropDatum>,
    redeemer: AirdropRedeemer,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    let Transaction { inputs, outputs, extra_signatories, .. } = self
    expect Some(datum) = datum
    let AirdropDatum {
      creator,
      policy_id,
      asset_name,
      amount,
      claimed,
      tag,
      claimants,
    } = datum

    expect Some(own_in) = find_input(inputs, own_ref)
    expect Script(_own_hash) = own_in.output.address.payment_credential

    when redeemer is {
      Claim(claimer) -> {
        expect Some(cont_out) = list.find(outputs, fn(out) {
          out.address == own_in.output.address
        })

        expect Output {
          address: cont_addr,
          value: cont_value,
          datum: InlineDatum(cont_datum),
          reference_script: None,
        } = cont_out

        let cont_has_correct_addr = cont_addr == own_in.output.address

        // Check eligible address
        expect Some((_, claim_amount)) = list.find(claimants, fn(claimant) {
          let (addr, _) = claimant
          addr.payment_credential == VerificationKey(claimer)
        })

        // Check continuing output value (minimum lovelace, correct token amount)
        let cont_has_correct_value = {
          let in_lovelace = lovelace_of(own_in.output.value)
          let remaining_tokens = amount - claimed
          and {
            lovelace_of(cont_value) >= in_lovelace,
            quantity_of(cont_value, policy_id, asset_name) >= remaining_tokens - claim_amount,
            list.length(flatten(cont_value)) <= 3,
          }
        }

        let cont_has_correct_datum = {
          expect cont_datum: AirdropDatum = cont_datum
          let expected_datum = AirdropDatum {
            ..datum,
            claimed: claimed + claim_amount,
            tag: Some(own_ref),
          }
          cont_datum == expected_datum
        }

        expect Some(claimer_out) = list.find(outputs, fn(out) {
          out.address.payment_credential == VerificationKey(claimer)
        })

        let claimer_receives_correct_amount =
          quantity_of(claimer_out.value, policy_id, asset_name) == claim_amount

        let claimer_signed = is_signed_by(extra_signatories, VerificationKey(claimer))
        let no_double_spend = tag == None
        let valid_claim = claimed + claim_amount <= amount
        and {
          cont_has_correct_addr?,
          cont_has_correct_value?,
          cont_has_correct_datum?,
          claimer_receives_correct_amount?,
          claimer_signed?,
          no_double_spend?,
          valid_claim?,
        }
      }

      Close -> {
        expect Some(creator_out) = list.find(outputs, fn(out) {
          out.address.payment_credential == VerificationKey(creator)
        })

        let creator_receives_remaining = {
          let remaining_tokens = amount - claimed
          quantity_of(creator_out.value, policy_id, asset_name) >= remaining_tokens
        }

        let creator_signed = is_signed_by(extra_signatories, VerificationKey(creator))
        let no_cont_out = list.all(outputs, fn(out) {
          out.address != own_in.output.address
        })

        and {
          creator_receives_remaining?,
          creator_signed?,
          no_cont_out?,
        }
      }

      AddRewards -> {
        expect Some(cont_out) = list.find(outputs, fn(out) {
          out.address == own_in.output.address
        })

        expect Output {
          address: cont_addr,
          value: cont_value,
          datum: InlineDatum(cont_datum),
          reference_script: None,
        } = cont_out
        let cont_has_correct_addr = cont_addr == own_in.output.address
        let cont_has_correct_datum = {
          expect cont_datum: AirdropDatum = cont_datum
          cont_datum == datum
        }

        let cont_has_more_tokens = {
          let in_tokens = quantity_of(own_in.output.value, policy_id, asset_name)
          let out_tokens = quantity_of(cont_value, policy_id, asset_name)
          and {
            out_tokens > in_tokens,
            lovelace_of(cont_value) >= lovelace_of(own_in.output.value),
            list.length(flatten(cont_value)) <= 3,
          }
        }
        let no_double_spend = tag == None
        let creator_signed = is_signed_by(extra_signatories, VerificationKey(creator))
        and {
          cont_has_correct_addr?,
          cont_has_correct_datum?,
          cont_has_more_tokens?,
          no_double_spend?,
          creator_signed?,
        }
      }
    }
  }

  mint(_redeemer: Data, _policy_id: PolicyId, _self: Transaction) {
    True
  }

  else(_) {
    fail
  }
}
