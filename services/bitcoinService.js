const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const bip39 = require('bip39');
const ecc = require('tiny-secp256k1');
const bip32 = require('bip32');

const network = bitcoin.networks.testnet; // Use mainnet for production

exports.generateWallet = async (mnemonic, privateKey) => {
  let seed, root;
  if (mnemonic) {
    seed = await bip39.mnemonicToSeed(mnemonic);
    root = bip32.fromSeed(seed, network);
  } else if (privateKey) {
    root = bip32.fromPrivateKey(Buffer.from(privateKey, 'hex'), Buffer.alloc(32), network);
  } else {
    mnemonic = bip39.generateMnemonic();
    seed = await bip39.mnemonicToSeed(mnemonic);
    root = bip32.fromSeed(seed, network);
  }

  const account = root.derivePath("m/84'/0'/0'"); // BIP84 for native SegWit
  const node = account.derive(0).derive(0);

  const { address } = bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network });

  return {
    type: 'bitcoin',
    address,
    publicKey: node.publicKey.toString('hex'),
    privateKey: node.privateKey.toString('hex'),
    mnemonic,
  };
};


exports.getBalance = async (address) => {
  const response = await axios.get(`https://blockstream.info/testnet/api/address/${address}`);
  return response.data.chain_stats.funded_txo_sum / 100000000; // Convert satoshis to BTC
};

exports.sendTransaction = async (fromAddress, toAddress, amount, privateKey) => {
  const keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network });
  const psbt = new bitcoin.Psbt({ network });

  const utxosResponse = await axios.get(`https://blockstream.info/testnet/api/address/${fromAddress}/utxo`);
  const utxos = utxosResponse.data;

  let totalInput = 0;
  for (const utxo of utxos) {
    const txResponse = await axios.get(`https://blockstream.info/testnet/api/tx/${utxo.txid}/hex`);
    const tx = bitcoin.Transaction.fromHex(txResponse.data);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: tx.outs[utxo.vout],
    });
    totalInput += utxo.value;
    if (totalInput >= amount * 100000000 + 1000) break; // Add 1000 satoshis for fee
  }

  psbt.addOutput({
    address: toAddress,
    value: Math.floor(amount * 100000000),
  });

  if (totalInput > amount * 100000000 + 1000) {
    psbt.addOutput({
      address: fromAddress,
      value: totalInput - Math.floor(amount * 100000000) - 1000,
    });
  }

  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();

  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();

  const broadcastResponse = await axios.post('https://blockstream.info/testnet/api/tx', txHex);
  return broadcastResponse.data; // Transaction ID
};

exports.generateAddress = async (publicKey) => {
  const pubkey = Buffer.from(publicKey, 'hex');
  const { address } = bitcoin.payments.p2wpkh({ pubkey, network });
  return address;
};

exports.getTransactionHistory = async (address) => {
  const response = await axios.get(`https://blockstream.info/testnet/api/address/${address}/txs`);
  return response.data.map(tx => ({
    txid: tx.txid,
    amount: tx.vout.reduce((sum, output) => sum + output.value, 0) / 100000000,
    fee: tx.fee / 100000000,
    confirmations: tx.status.confirmed ? tx.status.block_height : 0,
    timestamp: tx.status.block_time,
  }));
};

module.exports = exports;