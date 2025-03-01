use aiken/primitive/bytearray

pub type MintRedeemer {
  Mint
  Burn
}

pub type StoreRedeemer {
  Update
  Remove
}

pub const author_key: ByteArray = "_pk"