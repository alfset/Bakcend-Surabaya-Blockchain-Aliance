use aiken/collection/dict
use aiken/collection/list
use cardano/assets.{PolicyId, zero, tokens}
use cardano/transaction.{Input, OutputReference, Transaction} as tx
use cardano/address.{Address}
use mocktail.{complete, mint, mocktail_tx, tx_in}
use mocktail/virgin_address.{mock_pub_key_address}
use mocktail/virgin_key_hash.{mock_policy_id}
use mocktail/virgin_output_reference.{mock_tx_hash, mock_utxo_ref}

// Claim Validator
validator claim(token_name: ByteArray, policy_id: ByteArray, claimer: Address) {
 spend(_d: Option<Data>, _r: Data, input_ref: OutputReference, tx: Transaction) {
     let Transaction { inputs, mint, .. } = tx

     expect [Pair(asset_name, amount)] =
         mint
         |> tokens(policy_id)
         |> dict.to_pairs()

     let correct_token = amount == -1 && asset_name == token_name

     // Match the actual input by reference
     expect Some(input) =
         list.find(inputs, fn(i) { i.output_reference == input_ref })

     let correct_address = input.output.address == claimer

     correct_token && correct_address
 }

 else(_) {
     fail
 }
}

// Mint/Burn Actions
pub type Action {
 Mint
 Burn
}

// Pools Validator
validator pools(token_name: ByteArray, utxo_ref: OutputReference) {
 mint(rdmr: Action, policy_id: PolicyId, tx: Transaction) {
     let Transaction { inputs, mint, .. } = tx

     expect [Pair(asset_name, amount)] =
         mint
         |> tokens(policy_id)
         |> dict.to_pairs()

     when rdmr is {
         Mint -> {
             expect Some(_input) =
                 list.find(inputs, fn(input) { input.output_reference == utxo_ref })
             amount == 1 && asset_name == token_name
         }
         Burn -> amount == -1 && asset_name == token_name
     }
 }

 else(_) {
     fail
 }
}

// Test Struct
type TestCase {
 is_mint_info_correct: Bool,
 is_token_name_correct: Bool,
}

// Mock Tx Generator for Minting
fn get_mint_test_tx(test_case: TestCase) -> Transaction {
 let TestCase { is_mint_info_correct, is_token_name_correct } = test_case

 let token_name =
 if is_token_name_correct {
     "hello world"
 } else {
     "goodbye"
 }

 mocktail_tx()
 |> tx_in(True, mock_tx_hash(0), 0, zero, mock_pub_key_address(0, None))
 |> mint(is_mint_info_correct, 1, mock_policy_id(0), token_name)
 |> mint(!is_mint_info_correct, 2, mock_policy_id(0), token_name)
 |> complete()
}

// Successful Mint
test success_mint() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_mint_info_correct: True, is_token_name_correct: True }
 let tx = get_mint_test_tx(test_case)
 pools.mint(test_token_name, utxo, Mint, mock_policy_id(0), tx)
}

// Fail if multiple tokens minted
test fail_mint_with_more_than_1_mint() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_mint_info_correct: False, is_token_name_correct: True }
 let tx = get_mint_test_tx(test_case)
 !pools.mint(test_token_name, utxo, Mint, mock_policy_id(0), tx)
}

// Fail if wrong token name minted
test fail_mint_without_param_name_minted() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_mint_info_correct: True, is_token_name_correct: False }
 let tx = get_mint_test_tx(test_case)
 !pools.mint(test_token_name, utxo, Mint, mock_policy_id(0), tx)
}

// Mock Tx Generator for Claiming
fn get_claim_test_tx(test_case: TestCase, claimer: Address, utxo: OutputReference) -> Transaction {
 let TestCase { is_mint_info_correct, is_token_name_correct } = test_case

 let token_name =
 if is_token_name_correct {
     "hello world"
 } else {
     "goodbye"
 }

 let amount = if is_mint_info_correct { -1 } else { -2 }

 mocktail_tx()
 |> tx_in(True, utxo.transaction_id, utxo.output_index, zero, claimer)
 |> mint(True, amount, mock_policy_id(0), token_name)
 |> complete()
}

// Successful Claim by valid address
test success_claim() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_token_name_correct: True, is_mint_info_correct: True }
 let claimer = mock_pub_key_address(0, None)
 let tx = get_claim_test_tx(test_case, claimer, utxo)

 claim.spend(test_token_name, mock_policy_id(0), claimer, None, "", utxo, tx)
 && pools.mint(test_token_name, utxo, Burn, mock_policy_id(0), tx)
}

// Fail if wrong token name in claim
test fail_claim_without_correct_name() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_token_name_correct: False, is_mint_info_correct: True }
 let claimer = mock_pub_key_address(0, None)
 let tx = get_claim_test_tx(test_case, claimer, utxo)

 !(claim.spend(test_token_name, mock_policy_id(0), claimer, None, "", utxo, tx)
 && pools.mint(test_token_name, utxo, Burn, mock_policy_id(0), tx))
}

// Fail if wrong amount is burned
test fail_claim_without_correct_mint_info() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_token_name_correct: True, is_mint_info_correct: False }
 let claimer = mock_pub_key_address(0, None)
 let tx = get_claim_test_tx(test_case, claimer, utxo)

 !(claim.spend(test_token_name, mock_policy_id(0), claimer, None, "", utxo, tx)
 && pools.mint(test_token_name, utxo, Burn, mock_policy_id(0), tx))
}

// Fail if invalid claimer attempts claim
test fail_claim_invalid_claimer() {
 let test_token_name = "hello world"
 let utxo = mock_utxo_ref(0, 0)
 let test_case =
     TestCase { is_token_name_correct: True, is_mint_info_correct: True }
 let claimer = mock_pub_key_address(0, None)
 let wrong_claimer = mock_pub_key_address(1, None)
 let tx = get_claim_test_tx(test_case, claimer, utxo)

 !(claim.spend(test_token_name, mock_policy_id(0), wrong_claimer, None, "", utxo, tx)
 && pools.mint(test_token_name, utxo, Burn, mock_policy_id(0), tx))
}
