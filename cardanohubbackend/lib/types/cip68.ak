use aiken/collection/list
use aiken/primitive/bytearray
use aiken/crypto.{VerificationKeyHash}

// @type: Represents CIP-68 metadata for event NFTs
// Defines a structure for event NFT metadata, including URL, event name, image, date, and author.
pub type CIP68 {
  url: ByteArray,           // URL link to the event
  event_name: ByteArray,    // Name of the event
  image: ByteArray,         // Image URL or data for the event
  date: ByteArray,          // Date of the event (e.g., in ISO format)
  author: VerificationKeyHash  // Author’s public key hash
}

// @function: Retrieves the URL from CIP-68 event metadata
// Returns the URL field from the event metadata.
pub fn get_url(metadata: CIP68) -> ByteArray {
  metadata.url
}

// @function: Retrieves the event name from CIP-68 event metadata
// Returns the event name field from the event metadata.
pub fn get_event_name(metadata: CIP68) -> ByteArray {
  metadata.event_name
}

// @function: Retrieves the image from CIP-68 event metadata
// Returns the image field from the event metadata.
pub fn get_image(metadata: CIP68) -> ByteArray {
  metadata.image
}

// @function: Retrieves the date from CIP-68 event metadata
// Returns the date field from the event metadata.
pub fn get_date(metadata: CIP68) -> ByteArray {
  metadata.date
}

// @function: Retrieves the author from CIP-68 event metadata
// Returns the author field (VerificationKeyHash) from the event metadata.
pub fn get_author(metadata: CIP68) -> VerificationKeyHash {
  metadata.author
}

// @constant: Defines the prefix for CIP-68 reference tokens
// Represents the "100" prefix used for reference tokens in CIP-68 event NFTs.
pub const prefix_100: ByteArray = "100"

// @constant: Defines the prefix for CIP-68 user tokens
// Represents the "222" prefix used for user tokens in CIP-68 event NFTs.
pub const prefix_222: ByteArray = "222"