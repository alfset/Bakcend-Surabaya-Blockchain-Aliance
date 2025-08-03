import { Button } from "../components/Button";
import { readValidators } from "../lib/utils";
import { Constr, Data, Blockfrost, Lucid, Network, toHex, fromText } from "lucid-cardano";
import type { NextPage } from "next";
import { useCallback, useEffect, useState } from "react";

export async function getServerSideProps(context: {
  query: { lockAddress: string; txHash: string; outputIndex: string; policyId: string; assetName: string };
}) {
  const { lockAddress, txHash, outputIndex, policyId, assetName } = context.query;
  const validators = readValidators();

  const ENV = {
    BLOCKFROST_URL: process.env.BLOCKFROST_URL as string,
    BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_PROJECT_ID as string,
    NETWORK: process.env.NETWORK as string,
  };

  return {
    props: {
      ENV,
      lockAddress: lockAddress || null,
      txHash: txHash || null,
      outputIndex: outputIndex ? Number(outputIndex) : null,
      policyId: policyId || null,
      assetName: assetName || null,
      validators,
    },
  };
}

interface State {
  lucid?: Lucid;
  lockAddress: string | null;
  txHash: string | null;
  outputIndex: number | null;
  policyId: string | null;
  assetName: string | null;
  unlockTxHash?: string;
  waitingUnlockTx: boolean;
  error?: string;
  walletConnected: boolean;
  availableWallets: string[];
  callerVkh?: string;
  callerAddress?: string;
}

const Redeem: NextPage<ReturnType<typeof getServerSideProps>["props"]> = ({
  ENV,
  lockAddress,
  txHash,
  outputIndex,
  policyId,
  assetName,
  validators,
}) => {
  const [state, setState] = useState<State>({
    lucid: undefined,
    lockAddress,
    txHash,
    outputIndex,
    policyId,
    assetName,
    unlockTxHash: undefined,
    waitingUnlockTx: false,
    error: undefined,
    walletConnected: false,
    availableWallets: [],
    callerVkh: undefined,
    callerAddress: undefined,
  });

  const mergeSpecs = useCallback((delta: Partial<State>) => {
    setState(prev => ({ ...prev, ...delta }));
  }, []);

  useEffect(() => {
    async function initLucid() {
      if (!window.cardano) {
        mergeSpecs({ error: "No Cardano wallet extensions detected. Install Lace, Eternl, or Nami." });
        return;
      }
      const availableWallets = Object.keys(window.cardano).filter(
        key => window.cardano[key] && typeof window.cardano[key].enable === "function"
      );
      if (!availableWallets.length) {
        mergeSpecs({ error: "Enable a Cardano wallet: Lace, Eternl, or Nami." });
        return;
      }
      mergeSpecs({ availableWallets });
      const lucid = await Lucid.new(
        new Blockfrost(ENV.BLOCKFROST_URL, ENV.BLOCKFROST_PROJECT_ID),
        ENV.NETWORK as Network
      );
      for (const name of ["lace", "eternl", "nami"]) {
        if (window.cardano[name]) {
          try {
            const api = await window.cardano[name].enable();
            lucid.selectWallet(api);
            const address = await lucid.wallet.address();
            const details = lucid.utils.getAddressDetails(address);
            console.log("Wallet address:", address, "Details:", JSON.stringify(details, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
            const vkh = details.paymentCredential?.hash;
            if (!vkh) {
              console.error("Address details:", details);
              throw new Error(`No payment credential found in wallet address: ${address}`);
            }
            mergeSpecs({ lucid, walletConnected: true, callerAddress: address, callerVkh: vkh });
            return;
          } catch (err) {
            console.warn(`Failed to connect to ${name}:`, err);
          }
        }
      }
      mergeSpecs({ error: "No wallet connected. Please unlock and retry." });
    }
    initLucid();
  }, [ENV, mergeSpecs]);

  function normalizeData(value: any): any {
    try {
      if (value instanceof Constr) {
        return new Constr(value.index, value.fields.map(normalizeData));
      } else if (value instanceof Uint8Array) {
        return toHex(value); // Convert Uint8Array to hex string
      } else if (typeof value === "bigint") {
        return value;
      } else if (typeof value === "number") {
        return BigInt(value);
      } else if (typeof value === "string") {
        if (/^[0-9a-fA-F]+$/.test(value)) {
          return value; // Return hex string as-is
        }
        return toHex(value); // Convert UTF-8 to hex string
      } else if (Array.isArray(value)) {
        return new Constr(0, value.map(normalizeData));
      } else if (value === null || value === undefined) {
        return new Constr(1, []); // Plutus Maybe::Nothing
      } else if (typeof value === "object") {
        if (value.index !== undefined && Array.isArray(value.fields)) {
          return new Constr(value.index, value.fields.map(normalizeData));
        }
        if (value.dataType === "bytes") {
          const bytes = Object.keys(value)
            .filter(key => /^[0-9]+$/.test(key))
            .sort((a, b) => Number(a) - Number(b))
            .map(key => value[key])
            .join("");
          if (!/^[0-9a-fA-F]+$/.test(bytes)) {
            throw new Error(`Invalid ByteString object: ${JSON.stringify(value, null, 2)}`);
          }
          return bytes; // Return hex string
        }
        throw new Error(`Unsupported object type: ${JSON.stringify(value, null, 2)}`);
      }
      throw new Error(`Unsupported type: ${typeof value}, value: ${JSON.stringify(value, null, 2)}`);
    } catch (err) {
      console.error("normalizeData failed for value:", JSON.stringify(value, null, 2), "Error:", err);
      throw err;
    }
  }

const redeemAirdrop = async (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();

  const {
    lucid,
    lockAddress,
    txHash,
    outputIndex,
    policyId,
    assetName,
    callerVkh,
    callerAddress,
  } = state;

  if (
    !lucid ||
    !lockAddress ||
    !txHash ||
    outputIndex === null ||
    !policyId ||
    !assetName ||
    !callerVkh ||
    !callerAddress
  ) {
    mergeSpecs({ error: "Missing required inputs or wallet not connected." });
    return;
  }

  try {
    mergeSpecs({ error: undefined, waitingUnlockTx: true });

    const utxos = await lucid.utxosAt(lockAddress);
    const assetHex = toHex(Buffer.from(assetName, "utf8"));
    const fullAsset = `${policyId}${assetHex}`;

    const target =
      utxos.find((u) => u.txHash === txHash && u.outputIndex === outputIndex) ||
      utxos.find((u) => u.txHash === txHash) ||
      utxos.find((u) => u.assets[fullAsset] && u.datum);

    if (!target || !target.datum || !target.assets[fullAsset]) {
      throw new Error("Matching UTxO not found or missing datum/asset.");
    }

    console.log("Target UTxO:", JSON.stringify(target, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    console.log("Raw datum:", target.datum);

    const datumRaw = Data.from(target.datum);
    const datum = normalizeData(datumRaw);

    if (!(datum instanceof Constr) || datum.index !== 0 || datum.fields.length !== 7) {
      throw new Error("Datum structure mismatch.");
    }

    const [
      creatorRaw,
      policyIdDatumRaw,
      assetNameDatumRaw,
      amountRaw,
      claimedRaw,
      tagRaw,
      claimantsRaw,
    ] = datum.fields;

    console.log("creatorRaw:", creatorRaw);
    console.log("claimantsRaw:", JSON.stringify(claimantsRaw, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));

    // Validate types
    if (typeof creatorRaw !== "string" || !/^[0-9a-fA-F]+$/.test(creatorRaw)) {
      throw new Error(`creator must be a hex string, got: ${JSON.stringify(creatorRaw)}`);
    }
    if (typeof policyIdDatumRaw !== "string" || !/^[0-9a-fA-F]+$/.test(policyIdDatumRaw)) {
      throw new Error(`policyIdDatum must be a hex string, got: ${JSON.stringify(policyIdDatumRaw)}`);
    }
    if (typeof assetNameDatumRaw !== "string" || !/^[0-9a-fA-F]+$/.test(assetNameDatumRaw)) {
      throw new Error(`assetNameDatum must be a hex string, got: ${JSON.stringify(assetNameDatumRaw)}`);
    }
    if (typeof amountRaw !== "bigint") throw new Error("amount must be bigint");
    if (typeof claimedRaw !== "bigint") throw new Error("claimed must be bigint");
    if (!(tagRaw instanceof Constr)) throw new Error("tag must be a Constr");
    if (!(claimantsRaw instanceof Constr) || claimantsRaw.index !== 0) {
      throw new Error("claimants must be Constr(0, [...])");
    }

    // Check for double-spend (tag must be None)
    if (tagRaw.index !== 1 || tagRaw.fields.length !== 0) {
      throw new Error("Double spend detected: tag is not None.");
    }

    const claimants = claimantsRaw.fields;
    let foundClaimant = false;
    let tokenAmt = 0n;

    for (const c of claimants) {
      if (c instanceof Constr && c.index === 0 && c.fields.length === 2) {
        const [addr, alloc] = c.fields;
        if (
          addr instanceof Constr &&
          addr.index === 0 &&
          addr.fields.length === 2
        ) {
          const paymentCredRaw = addr.fields[0];
          if (
            paymentCredRaw instanceof Constr &&
            paymentCredRaw.index === 0 &&
            paymentCredRaw.fields.length === 1
          ) {
            const claimantVkhRaw = paymentCredRaw.fields[0];
            if (typeof claimantVkhRaw !== "string" || !/^[0-9a-fA-F]+$/.test(claimantVkhRaw)) {
              throw new Error(`claimantVkh must be a hex string, got: ${JSON.stringify(claimantVkhRaw)}`);
            }
            if (claimantVkhRaw === callerVkh) {
              tokenAmt = BigInt(alloc);
              foundClaimant = true;
              break;
            }
          }
        }
      }
    }

    if (!foundClaimant || tokenAmt <= 0n) {
      throw new Error("Caller not in claimants list or has zero allocation.");
    }

    const updatedClaimed = claimedRaw + tokenAmt;

    if (!/^[0-9a-fA-F]+$/.test(txHash)) {
      throw new Error(`Invalid txHash: ${txHash}`);
    }
    const outputIndexInt = Number(outputIndex);
    if (isNaN(outputIndexInt) || outputIndexInt < 0) {
      throw new Error(`Invalid outputIndex: ${outputIndex}`);
    }

    // Construct updatedTag with explicit Data types
    const outputRefDatum = new Constr(0, [
      Data.Bytes(txHash), // Wrap txHash in Data.Bytes
      Data.Integer(BigInt(outputIndexInt)), // Wrap outputIndexInt in Data.Integer
    ]) as Constr<Data>;
    const updatedTag = new Constr(1, [outputRefDatum]) as Constr<Data>;

    // Serialize individual fields to catch errors early
    try {
      Data.to(creatorRaw);
      Data.to(policyIdDatumRaw);
      Data.to(assetNameDatumRaw);
      Data.to(amountRaw);
      Data.to(updatedClaimed);
      console.log("Serializing updatedTag:", JSON.stringify(updatedTag, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      Data.to(updatedTag);
      console.log("datum tag:", Data.to(updatedTag));
      console.log("Serializing claimantsRaw:", JSON.stringify(claimantsRaw, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      Data.to(claimantsRaw);
    } catch (err) {
      throw new Error(`Failed to serialize datum field: ${err instanceof Error ? err.message : String(err)}`);
    }

    const updatedDatum = new Constr(0, [
      Data.Bytes(creatorRaw),
      Data.Bytes(policyIdDatumRaw),
      Data.Bytes(assetNameDatumRaw),
      Data.Integer(amountRaw),
      Data.Integer(updatedClaimed),
      updatedTag, // Use pre-constructed updatedTag
      Data.to(claimantsRaw),
    ]);

    console.log("updatedDatum before serialization:", JSON.stringify(updatedDatum, (k, v) => {
      if (typeof v === "bigint") return v.toString();
      return v;
    }, 2));

    const serializedUpdatedDatum = Data.to(updatedDatum);
    const fullAssetAmount = BigInt(target.assets[fullAsset]);
    if (fullAssetAmount < tokenAmt) {
      throw new Error("UTxO has insufficient tokens for claim.");
    }
    const remainingTokens = fullAssetAmount - tokenAmt;
    const amountBigInt = amountRaw;
    const lovelacePerClaimant = amountBigInt / BigInt(claimants.length);
    const remainingLovelace = amountBigInt - lovelacePerClaimant;

    const redeemer = new Constr(0, [Data.Bytes(callerVkh)]);

    const tx = await lucid
      .newTx()
      .collectFrom([target], Data.to(redeemer))
      .attachSpendingValidator({ type: "PlutusV2", script: validators.airdropSpend.script })
      .payToAddress(callerAddress, {
        [fullAsset]: tokenAmt,
        lovelace: lovelacePerClaimant,
      })
      .payToContract(lockAddress, { inline: serializedUpdatedDatum }, {
        [fullAsset]: remainingTokens,
        lovelace: remainingLovelace,
      })
      .complete();

    const signed = await tx.sign().complete();
    const hash = await signed.submit();
    const ok = await lucid.awaitTx(hash);

    mergeSpecs({ waitingUnlockTx: false, unlockTxHash: ok ? hash : undefined });
  } catch (err) {
    mergeSpecs({
      waitingUnlockTx: false,
      error: `Redeem failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    console.error("Redeem error:", err);
  }
};

  return (
    <main>
      <h1>Redeem Airdrop</h1>
      <p>
        Locked address: {state.lockAddress}
        <br />
        TxHash: {state.txHash}
        <br />
        Output Index: {state.outputIndex}
        <br />
        PolicyId: {state.policyId}
        <br />
        AssetName: {state.assetName}
      </p>
      {state.error && <p style={{ color: "red" }}>Error: {state.error}</p>}
      {state.waitingUnlockTx && <p>Waiting for transaction confirmation...</p>}
      {state.walletConnected ? (
        <Button disabled={state.waitingUnlockTx} onClick={redeemAirdrop}>
          Redeem
        </Button>
      ) : (
        <p>Please connect a supported Cardano wallet first.</p>
      )}
      {state.unlockTxHash && (
        <p>
          Unlock transaction submitted:{" "}
          <a
            href={`https://cardanoscan.io/transaction/${state.unlockTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {state.unlockTxHash}
          </a>
        </p>
      )}
    </main>
  );
};

export default Redeem;