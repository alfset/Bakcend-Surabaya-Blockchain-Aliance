import { Data } from "lucid-cardano";

export interface AirdropDatum {
  creator: string;
  policy_id: string;
  asset_name: string;
  amount: bigint;
  claimed: bigint;
  tag: Data;
  claimants: Data[];
}

export interface AirdropRedeemer {
  Claim?: { verificationKeyHash: string };
  Close?: {};
  AddRewards?: {};
}