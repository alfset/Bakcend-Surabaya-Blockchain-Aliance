# Cardano Event NFT Validator

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
