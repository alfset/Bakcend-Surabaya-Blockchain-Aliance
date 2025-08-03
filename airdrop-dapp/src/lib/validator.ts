import type { Lucid, MintingPolicy, SpendingValidator } from "lucid-cardano";
import { applyDoubleCborEncoding } from "lucid-cardano";
import type { Blueprint } from "./blueprint";
import { PLUTUS_JSON as blueprint } from "./plutus";

export type Validators = {
  spend: SpendingValidator;
  mint: MintingPolicy;
};

export type AppliedValidators = {
  spend: SpendingValidator;
  mint: MintingPolicy;
  policyId: string;
  lockAddress: string;
};

export function readValidators(): Validators {
  const spend = (blueprint as Blueprint).validators.find(
    (v) => v.title === "airdrop.airdrop.spend"
  );

  if (!spend) {
    throw new Error("Spend validator not found");
  }

  const mint = (blueprint as Blueprint).validators.find(
    (v) => v.title === "airdrop.airdrop.mint"
  );

  if (!mint) {
    throw new Error("Mint validator not found");
  }

  return {
    spend: {
      type: "PlutusV2",
      script: spend.compiledCode,
    },
    mint: {
      type: "PlutusV2",
      script: mint.compiledCode,
    },
  };
}

export function applyParams(lucid: Lucid): AppliedValidators {
  const validators = readValidators();

  const policyId = lucid.utils.validatorToScriptHash(validators.mint);
  const lockAddress = lucid.utils.validatorToAddress(validators.spend);

  return {
    spend: {
      type: "PlutusV2",
      script: applyDoubleCborEncoding(validators.spend.script),
    },
    mint: {
      type: "PlutusV2",
      script: applyDoubleCborEncoding(validators.mint.script),
    },
    policyId,
    lockAddress,
  };
}