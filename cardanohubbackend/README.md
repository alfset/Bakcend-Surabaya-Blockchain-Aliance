# Cardano Event NFT

## Overview

This project validates transactions for creating or burning CIP-68 compliant event NFTs (non-fungible tokens) on the Cardano blockchain. The code handles minting, burning, and validating event NFTs by ensuring the integrity of metadata, platform fees, author signatures, and token pairing.

### Key Features:
- **Minting and Burning Validation:** Ensures proper minting and burning of event NFTs.
- **Metadata Validation:** Checks for proper event metadata such as URL, name, image, date, and author.
- **Platform Fee Validation:** Ensures correct handling of platform fees during minting or burning.
- **Author Signature Verification:** Verifies that the author's signature is valid for minting or burning.
- **Transaction Validation:** Validates the integrity of UTxOs, outputs, and other transaction details.

## Functions

### `validate`
The main function to validate a Cardano transaction that mints or burns event NFTs. This function checks whether the transaction:
- Correctly validates the minting or burning of event NFTs.
- Ensures the platform fee is correctly handled.
- Validates the metadata during minting (event name, URL, image, date).
- Ensures author signatures are correctly verified.
- Ensures output and input updates based on the mint or burn redeemer.

**Parameters:**
- `redeemer`: Determines if the transaction is a mint or burn.
- `platform_address`: Address of the platform receiving the platform fee.
- `platform_fee`: Amount to be sent to the platform address.
- `store_address`: Address where the minted event NFT reference token is stored.
- `user_address`: Address receiving the user token.
- `issuer`: The author of the event NFT.
- `policy_id`: Policy ID for the event NFT.
- `tx`: The Cardano transaction to validate.

### `MintRedeemer`
This represents the minting or burning action. The function can perform checks based on whether the redeemer is for minting (`Mint`) or burning (`Burn`).

### Utility Functions:
- **`check_output_remove`**: Validates that the output transaction meets the expected conditions for removing assets.
- **`check_output_update`**: Validates that the number of UTxOs at a given address is unchanged.
- **`check_asset_mint`**: Validates the minting process of the event NFT.
- **`check_asset_burn`**: Validates the burning process of the event NFT.
- **`find_input_reference_asset`**: Searches for reference event assets in the transaction inputs.

## Tests

### 1. **`mint_event_nft_success`**
- **Description**: Tests a successful minting of an event NFT with valid metadata.
- **Expected Outcome**: The transaction should pass validation, as all metadata is correct, the platform fee is handled properly, and the minting process is valid.

### 2. **`mint_event_nft_missing_url`**
- **Description**: Tests minting a transaction where the metadata has a missing URL (empty URL).
- **Expected Outcome**: The transaction should fail validation, as the URL is a required field in the event metadata.

### 3. **`mint_event_nft_wrong_signature`**
- **Description**: Tests a minting transaction where the author's signature is incorrect (the wrong issuer signs the transaction).
- **Expected Outcome**: The transaction should fail validation because the author signature does not match the expected issuer.

## How to Use

### test the Code
To build the project, run the following command:

```sh
aiken check
```

# Pools Reward Initiator and Claiming
## Key Features

- **Minting and Burning Validation:** Ensures proper minting and burning of event claim rewards.
- **Token Name Validation:** Verifies the correct token name during minting and burning.
- **Claimer Address Validation:** Confirms the claimer’s address for secure token claiming.
- **Single Token Transaction:** Ensures only one token is minted or burned per transaction.
- **UTxO Reference Validation:** Validates specific UTxO references for minting.

---

## Functions

### `claim.spend`

The main function to validate a spending transaction for claiming a **claim reward** by burning a token. It checks whether the transaction:

- Burns exactly one token with the correct `token_name` and amount (`-1`).
- Includes an input matching the specified `input_ref` with an output address matching the claimer.

**Parameters:**

- `token_name: ByteArray` – Expected name of the token.
- `policy_id: ByteArray` – Policy ID of the token.
- `claimer: Address` – Address authorized to claim the token.
- `_d: Option<Data>` – Optional datum (unused).
- `_r: Data` – Redeemer data (unused).
- `input_ref: OutputReference` – Reference to the input UTxO.
- `tx: Transaction` – The Cardano transaction to validate.

---

### `pools.mint`

Validates minting or burning of claim rewards based on the `Action` redeemer. It ensures:

- Exactly one token is minted (amount == `1`) or burned (amount == `-1`) with the correct `token_name`.
- For minting, an input matches the specified `utxo_ref`.

**Parameters:**

- `token_name: ByteArray` – Expected name of the token.
- `utxo_ref: OutputReference` – Reference to the UTxO for minting validation.
- `rdmr: Action` – Specifies `Mint` or `Burn` action.
- `policy_id: PolicyId` – Policy ID of the token.
- `tx: Transaction` – The Cardano transaction to validate.

---

### `get_mint_test_tx`

Generates a mock transaction for testing minting scenarios.

**Parameters:**

- `test_case: TestCase` – Configures the test with `is_mint_info_correct` and `is_token_name_correct`.

**Logic:**

- Sets `token_name` to `"hello world"` if `is_token_name_correct` is `true`, otherwise `"goodbye"`.
- Mints tokens with amount `1` or `2` based on `is_mint_info_correct`.
- Returns a completed transaction with one input.

---

### `get_claim_test_tx`

Generates a mock transaction for testing claiming scenarios.

**Parameters:**

- `test_case: TestCase` – Configures the test.
- `claimer: Address` – Address claiming the token.
- `utxo: OutputReference` – UTxO reference for the input.

**Logic:**

- Sets `token_name` to `"hello world"` if `is_token_name_correct` is `true`, otherwise `"goodbye"`.
- Burns tokens with amount `-1` or `-2` based on `is_mint_info_correct`.
- Returns a completed transaction with one input from claimer.

---

## Types

### `Action`

Represents minting or burning actions.

```aiken
pub type Action {
  Mint
  Burn
}

```
## Tests

### ✅ success_mint

- **Description**: Tests successful minting with correct token name (`"hello world"`) and amount (1).
- **Expected Outcome**: The `pools.mint` validator passes.

---

### ❌ fail_mint_with_more_than_1_mint

- **Description**: Tests minting failure when multiple tokens are minted (amount 2).
- **Expected Outcome**: The `pools.mint` validator fails.

---

### ❌ fail_mint_without_param_name_minted

- **Description**: Tests minting failure with an incorrect token name (`"goodbye"`).
- **Expected Outcome**: The `pools.mint` validator fails.

---

### ✅ success_claim

- **Description**: Tests successful claiming with correct token name (`"hello world"`), burn amount (-1), and valid claimer address.
- **Expected Outcome**: Both `claim.spend` and `pools.mint` (with `Burn`) validators pass.

---

### ❌ fail_claim_without_correct_name

- **Description**: Tests claiming failure with an incorrect token name (`"goodbye"`).
- **Expected Outcome**: The `claim.spend` and `pools.mint` validators fail.

---

### ❌ fail_claim_without_correct_mint_info

- **Description**: Tests claiming failure with an incorrect burn amount (-2).
- **Expected Outcome**: The `claim.spend` and `pools.mint` validators fail.

---

### ❌ fail_claim_invalid_claimer

- **Description**: Tests claiming failure with an invalid claimer address.
- **Expected Outcome**: The `claim.spend` and `pools.mint` validators fail.

