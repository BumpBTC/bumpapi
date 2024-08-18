const litecore = require('litecore-lib');
const axios = require('axios');
const bip39 = require('bip39');

const network = litecore.Networks.testnet; // Use mainnet for production
const LITECOIN_API_URL = 'https://chain.so/api/v2/ltc/test'; // Use mainnet URL for production

exports.generateLitecoinWallet = async (mnemonic, privateKey) => {
  let seed, hdPrivateKey;
  if (mnemonic) {
    seed = await bip39.mnemonicToSeed(mnemonic);
    hdPrivateKey = litecore.HDPrivateKey.fromSeed(seed, network);
  } else if (privateKey) {
    hdPrivateKey = new litecore.HDPrivateKey(privateKey);
  } else {
    mnemonic = bip39.generateMnemonic();
    seed = await bip39.mnemonicToSeed(mnemonic);
    hdPrivateKey = litecore.HDPrivateKey.fromSeed(seed, network);
  }

  const derived = hdPrivateKey.derive("m/44'/2'/0'/0/0");
  const address = derived.publicKey.toAddress().toString();

  return {
    type: 'litecoin',
    address,
    publicKey: derived.publicKey.toString(),
    privateKey: derived.privateKey.toString(),
    mnemonic,
  };
};

exports.getLitecoinBalance = async (address) => {
  const response = await axios.get(`${LITECOIN_API_URL}/get_address_balance/${address}`);
  return parseFloat(response.data.data.confirmed_balance);
};

exports.sendLitecoin = async (fromAddress, toAddress, amount, privateKey) => {
  const utxosResponse = await axios.get(`${LITECOIN_API_URL}/get_tx_unspent/${fromAddress}`);
  const utxos = utxosResponse.data.data.txs;

  const tx = new litecore.Transaction()
    .from(utxos)
    .to(toAddress, Math.floor(amount * 100000000))
    .change(fromAddress)
    .sign(privateKey);

  const txHex = tx.serialize();

  const broadcastResponse = await axios.post(`${LITECOIN_API_URL}/send_tx`, { tx_hex: txHex });
  return broadcastResponse.data.data.txid;
};

exports.generateLitecoinAddress = async (publicKey) => {
  const pubKey = new litecore.PublicKey(publicKey);
  return pubKey.toAddress(network).toString();
};

exports.getLitecoinTransactionHistory = async (address) => {
  const response = await axios.get(`${LITECOIN_API_URL}/address/${address}`);
  return response.data.data.txs.map(tx => ({
    txid: tx.txid,
    amount: parseFloat(tx.value),
    confirmations: tx.confirmations,
    timestamp: tx.time,
  }));
};

module.exports = exports;