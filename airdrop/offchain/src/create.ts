import {
  Asset,
  mConStr0,
  stringToHex,
  deserializeAddress,
} from "@meshsdk/core";
import { getScript, getTxBuilder, getWalletInfoForTx, wallet, getWalletBalance } from "./common";
import blueprint from "../plutus.json";

const networkId = 0;

export async function create(
  tokenName: string,
  amount: string,
  claimants: { address: string; amount: number }[],
  policyId: string
): Promise<string> {
  console.log("Starting airdrop creation...");
  await getWalletBalance();

  const { utxos, walletAddress, collateral } = await getWalletInfoForTx();
  console.log("Wallet Address for Change:", walletAddress);
  const tokenNameHex = stringToHex(tokenName);
  console.log("Token Name Hex:", tokenNameHex);

  const collateralTxId = collateral.input.txHash + "#" + collateral.input.outputIndex;
  const firstUtxo = utxos.find(utxo => 
    (utxo.input.txHash + "#" + utxo.input.outputIndex) !== collateralTxId &&
    utxo.output.amount.some(asset => 
      asset.unit === "lovelace" && parseInt(asset.quantity) >= 5000000
    )
  );
  if (!firstUtxo) throw new Error("No non-collateral UTxO with sufficient lovelace available");
  const remainingUtxos = utxos.filter(utxo => 
    (utxo.input.txHash + "#" + utxo.input.outputIndex) !== 
    (firstUtxo.input.txHash + "#" + firstUtxo.input.outputIndex) &&
    (utxo.input.txHash + "#" + utxo.input.outputIndex) !== collateralTxId
  );
  console.log("First UTxO:", {
    txHash: firstUtxo.input.txHash,
    outputIndex: firstUtxo.input.outputIndex,
    amount: firstUtxo.output.amount
  });
  console.log("Remaining UTxOs:", remainingUtxos.map(utxo => ({
    txHash: utxo.input.txHash,
    outputIndex: utxo.input.outputIndex,
    amount: utxo.output.amount
  })));

  const { scriptCbor, address } = getScript(
    blueprint.validators[0].compiledCode,
    tokenNameHex,
    firstUtxo.input.txHash,
    firstUtxo.input.outputIndex,
    networkId
  );
  console.log("Script Address:", address);
  console.log("Plutus Version:", blueprint.preamble.plutusVersion);

  const creatorAddress = (await wallet.getUsedAddresses())[0];
  console.log("Creator Address:", creatorAddress);
  const creatorAddressObj = deserializeAddress(creatorAddress);
  if (!creatorAddressObj.pubKeyHash) throw new Error("Failed to parse creator address public key hash");
  const creatorVkhHex = creatorAddressObj.pubKeyHash;
  console.log("Creator Public Key Hash:", creatorVkhHex);

  const claimantsList = claimants.map(({ address, amount }) => {
    const addressObj = deserializeAddress(address);
    if (!addressObj.pubKeyHash) throw new Error(`Failed to parse address public key hash: ${address}`);
    return [addressObj.pubKeyHash, amount];
  });
  console.log("Claimants List:", claimantsList);

  const datum = mConStr0([
    creatorVkhHex,
    policyId,
    tokenNameHex,
    parseInt(amount),
    0,
    mConStr0([firstUtxo.input.txHash, firstUtxo.input.outputIndex]),
    claimantsList,
  ]);

  const assets: Asset[] = [
    { unit: "lovelace", quantity: "5000000" },
    { unit: policyId + tokenNameHex, quantity: amount },
  ];
  console.log("Assets for Script Output:", assets);

  const expectedTokenUnit = policyId + tokenNameHex;
  console.log("Expected Token Unit:", expectedTokenUnit);
  const tokenUtxo = utxos.find((utxo) =>
    utxo.output.amount.some(
      (asset) => {
        const matches = asset.unit === expectedTokenUnit && parseInt(asset.quantity) >= parseInt(amount);
        console.log(`Checking UTxO asset: txHash=${utxo.input.txHash}, unit=${asset.unit}, quantity=${asset.quantity}, matches=${matches}`);
        return matches;
      }
    )
  );
  if (!tokenUtxo) {
    console.log("Available token units in wallet:");
    utxos.forEach(utxo => {
      utxo.output.amount.forEach(asset => {
        if (asset.unit !== "lovelace") {
          console.log(`Token: ${asset.unit}, Quantity: ${asset.quantity}`);
        }
      });
    });
    throw new Error(`No UTxO found with sufficient tokens for ${expectedTokenUnit}`);
  }
  console.log("Selected Token UTxO:", {
    txHash: tokenUtxo.input.txHash,
    outputIndex: tokenUtxo.input.outputIndex,
    amount: tokenUtxo.output.amount
  });

  const txBuilder = getTxBuilder();
  console.log("Building transaction...");
  try {
    const tx = await txBuilder
      .txIn(
        firstUtxo.input.txHash,
        firstUtxo.input.outputIndex,
        firstUtxo.output.amount,
        firstUtxo.output.address
      )
      .txIn(
        tokenUtxo.input.txHash,
        tokenUtxo.input.outputIndex,
        tokenUtxo.output.amount,
        tokenUtxo.output.address
      )
      .txOut(address, assets)
      .txOutInlineDatumValue(datum)
      .changeAddress(walletAddress)
      .txInCollateral(
        collateral.input.txHash,
        collateral.input.outputIndex,
        collateral.output.amount,
        collateral.output.address
      )
      .selectUtxosFrom(remainingUtxos)
      .complete();
    console.log("Transaction built successfully");
    console.log("Transaction Hex:", tx);
    return tx;
  } catch (error) {
    console.error("Error building transaction:", error);
    throw error;
  }
}

async function main() {
  const tokenName = "TKN";
  const totalAmount = "1100";
  const policyId = "c1d093bc44207d56234db78aee4eead7e203bc8c3afeddc62959d145";
  const claimants = [
    { address: "addr_test1qq7k2t7rj8yhgwa9k7pks4jkl7fjpecgwammu6krc287esqm5rxa994lfcfsh0n3xz83k3ncy658dh36afmfmesm62rsp4qyh2", amount: 50 },
    { address: "addr_test1qqccq0vlg04my0cg70terejglnvqy34c0tzpnznyl3tk64g3jkuhxs3qsx8uurrw9yu8nrdqg9fywms275jmsmd2qk5qz6uh55", amount: 50 },
    { address: "addr_test1qq7k2t7rj8yhgwa9k7pks4jkl7fjpecgwammu6krc287esqm5rxa994lfcfsh0n3xz83k3ncy658dh36afmfmesm62rsp4qyh2", ammount: 1000},
  ];

  try {
    console.log("Calling create function...");
    const unsignedTx = await create(tokenName, totalAmount, claimants, policyId);
    console.log("Signing transaction...");
    const signedTx = await wallet.signTx(unsignedTx);
    console.log("Submitting transaction...");
    const txHash = await wallet.submitTx(signedTx);
    console.log("Transaction Hash:", txHash);
  } catch (error) {
    console.error("Error creating airdrop:", error);
  }
}

main();
