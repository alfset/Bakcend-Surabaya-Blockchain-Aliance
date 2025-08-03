import { Lucid, MintingPolicy, OutRef, SpendingValidator, applyParamsToScript, Constr, fromText } from "lucid-cardano";
import type { Blueprint } from "./blueprint";
import { PLUTUS_JSON } from "./plutus";

export interface Validators {
  airdropSpend: SpendingValidator;
  airdropMint: MintingPolicy;
}

export interface AppliedValidators {
  airdropSpend: SpendingValidator;
  airdropMint: MintingPolicy;
  policyId: string;
  lockAddress: string;
}

export function readValidators(): Validators {
  const blueprint = PLUTUS_JSON as Blueprint;
  const airdropSpend = blueprint.validators.find((v) => v.title === "airdrop.airdrop.spend");
  if (!airdropSpend) throw new Error("Airdrop spend validator not found");
  const airdropMint = blueprint.validators.find((v) => v.title === "airdrop.airdrop.mint");
  if (!airdropMint) throw new Error("Airdrop mint validator not found");
  return {
    airdropSpend: { type: "PlutusV2", script: airdropSpend.compiledCode },
    airdropMint: { type: "PlutusV2", script: airdropMint.compiledCode },
  };
}

export function applyParams(tokenName: string, outputReference: OutRef, validators: Validators, lucid: Lucid): AppliedValidators {
  const outRef = new Constr(0, [
    new Constr(0, [outputReference.txHash]),
    BigInt(outputReference.outputIndex),
  ]);
  const mintScript = validators.airdropMint.script;
  const policyId = lucid.utils.validatorToScriptHash(validators.airdropMint);
  const spendScript = applyParamsToScript(validators.airdropSpend.script, [
    fromText(tokenName),
    policyId,
  ]);
  const lockAddress = lucid.utils.validatorToAddress({ type: "PlutusV2", script: spendScript });
  console.log("Parameterized spendScript Hash:", lucid.utils.validatorToScriptHash({ type: "PlutusV2", script: spendScript }));
  return {
    airdropSpend: { type: "PlutusV2", script: spendScript },
    airdropMint: { type: "PlutusV2", script: mintScript },
    policyId,
    lockAddress,
  };
}
