import {
  BlockfrostProvider,
  builtinByteString,
  MeshTxBuilder,
  MeshWallet,
  outputReference,
  serializePlutusScript,
  UTxO,
  applyParamsToScript,
} from "@meshsdk/core";
import dotenv from "dotenv";
import * as readline from "node:readline/promises";

dotenv.config();

export const blockfrost_api_key = process.env.BLOCKFROST_API_KEY || "";
export const wallet_mnemonic = process.env.MNEMONIC
  ? process.env.MNEMONIC.split(",")
  : "solution,".repeat(24).split(",").slice(0, 24);

export const blockchainProvider = new BlockfrostProvider(blockfrost_api_key);

export const wallet = new MeshWallet({
  networkId: 0, 
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
  key: {
    type: "mnemonic",
    words: wallet_mnemonic,
  },
});

export async function getWalletBalance() {
  const addresses = await wallet.getUsedAddresses();
  const balance = await wallet.getBalance();
  const utxos = await wallet.getUtxos();
  const collateral = await wallet.getCollateral();
  console.log("Wallet Balance:", balance);
  console.log("Wallet UTxOs:", utxos.map(utxo => ({
    txHash: utxo.input.txHash,
    outputIndex: utxo.input.outputIndex,
    amount: utxo.output.amount
  })));
  console.log("Collateral UTxOs:", collateral);
  return { addresses, balance, utxos, collateral };
}

async function createCollateralUtxo(): Promise<UTxO> {
  try {
    const utxos = await wallet.getUtxos();
    const walletAddress = await wallet.getChangeAddress();
    if (!utxos.length) throw new Error("No UTxOs available to create collateral");

    const txBuilder = new MeshTxBuilder({
      fetcher: blockchainProvider,
      submitter: blockchainProvider,
    });

    const inputUtxo = utxos.find(utxo =>
      utxo.output.amount.some(asset => 
        asset.unit === "lovelace" && parseInt(asset.quantity) >= 5000000
      )
    );
    if (!inputUtxo) throw new Error("No UTxO with at least 10 ADA to create collateral");

    await txBuilder
      .txIn(
        inputUtxo.input.txHash,
        inputUtxo.input.outputIndex,
        inputUtxo.output.amount,
        inputUtxo.output.address
      )
      .txOut(walletAddress, [{ unit: "lovelace", quantity: "5000000" }]) 
      .changeAddress(walletAddress)
      .selectUtxosFrom(utxos.filter(utxo => utxo !== inputUtxo))
      .complete();

    const signedTx = await wallet.signTx(txBuilder.txHex);
    const txHash = await wallet.submitTx(signedTx);
    console.log("Collateral UTxO created. Tx Hash:", txHash);
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      try {
        const newUtxos = await wallet.getUtxos();
        const collateralUtxo = newUtxos.find(utxo =>
          utxo.output.amount.length === 1 &&
          utxo.output.amount[0].unit === "lovelace" &&
          parseInt(utxo.output.amount[0].quantity) >= 5000000
        );
        if (collateralUtxo) {
          console.log("Collateral UTxO confirmed:", {
            txHash: collateralUtxo.input.txHash,
            outputIndex: collateralUtxo.input.outputIndex,
            amount: collateralUtxo.output.amount
          });
          return collateralUtxo;
        }
      } catch (error) {
        console.log("Error checking UTxOs, retrying...", error);
      }
      await new Promise(resolve => setTimeout(resolve, 20000)); 
      attempts++;
    }
    throw new Error("Collateral UTxO not confirmed after waiting");
  } catch (error) {
    throw new Error(`Failed to create collateral UTxO: ${error}`);
  }
}

export async function getWalletInfoForTx() {
  const addresses = await wallet.getUsedAddresses();
  console.log("Wallet Addresses Queried for UTxOs:", addresses);
  const utxos = await wallet.getUtxos();
  console.log("Fetched UTxOs:", utxos.map(utxo => ({
    txHash: utxo.input.txHash,
    outputIndex: utxo.input.outputIndex,
    amount: utxo.output.amount
  })));
  const walletAddress = await wallet.getChangeAddress();

  if (!utxos || utxos.length === 0) {
    throw new Error("No UTxOs found in wallet. Fund the wallet with at least 15 ADA.");
  }
  if (!walletAddress) {
    throw new Error("No wallet address found");
  }

  let collateral = (await wallet.getCollateral())[0];
  if (!collateral) {
    console.log("No collateral found via getCollateral, attempting to select or create one");
    collateral = utxos.find(utxo =>
      utxo.output.amount.some(asset => 
        asset.unit === "lovelace" && parseInt(asset.quantity) >= 5000000
      ) && utxo.output.amount.length === 1
    );
    if (!collateral) {
      console.log("No suitable collateral UTxO found, creating one automatically");
      collateral = await createCollateralUtxo();
    }
  }
  console.log("Selected Collateral UTxO:", {
    txHash: collateral.input.txHash,
    outputIndex: collateral.input.outputIndex,
    amount: collateral.output.amount
  });

  return { utxos, collateral, walletAddress };
}

export function getScript(
  blueprintCompiledCode: string,
  tokenNameHex: string,
  utxoTxHash: string,
  utxoTxId: number,
  networkId = 0
) {
  const utxo = outputReference(utxoTxHash, utxoTxId);
  const scriptCbor = applyParamsToScript(
    blueprintCompiledCode,
    [builtinByteString(tokenNameHex), utxo],
    "JSON"
  );
  const { address } = serializePlutusScript(
    { code: scriptCbor, version: "V3" },
    undefined,
    networkId
  );
  return { scriptCbor, address };
}

export function redeemCbor(
  blueprintCompiledCode: string,
  tokenNameHex: string,
  policyId: string
) {
  return applyParamsToScript(blueprintCompiledCode, [
    builtinByteString(tokenNameHex),
    builtinByteString(policyId),
  ]);
}

export function getTxBuilder() {
  return new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
  });
}

export async function getUtxoByTxHash(txHash: string): Promise<UTxO> {
  const utxos = await blockchainProvider.fetchUTxOs(txHash);
  if (utxos.length === 0) {
    throw new Error("UTxO not found");
  }
  return utxos[0];
}

export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const res = await rl.question(question);
  rl.close();
  return res;
}
