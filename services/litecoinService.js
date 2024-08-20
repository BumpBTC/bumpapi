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
  try {
    const response = await axios.get(`${LITECOIN_API_URL}/get_address_balance/LTCTEST/${address}`);
    return parseFloat(response.data.data.confirmed_balance);
  } catch (error) {
    console.error('Failed to get Litecoin balance:', error);
    throw error;
  }
};

exports.sendLitecoin = async (fromAddress, toAddress, amount, privateKey) => {
  try {
    const utxosResponse = await axios.get(`${LITECOIN_API_URL}/get_tx_unspent/LTCTEST/${fromAddress}`);
    const utxos = utxosResponse.data.data.txs.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.output_no,
      scriptPubKey: utxo.script_hex,
      satoshis: Math.floor(parseFloat(utxo.value) * 100000000),
    }));

    const tx = new litecore.Transaction()
      .from(utxos)
      .to(toAddress, Math.floor(amount * 100000000))
      .change(fromAddress)
      .sign(privateKey);

    const txHex = tx.serialize();

    const broadcastResponse = await axios.post(`${LITECOIN_API_URL}/send_tx/LTCTEST`, { tx_hex: txHex });
    return broadcastResponse.data.data.txid;
  } catch (error) {
    console.error('Failed to send Litecoin:', error);
    throw error;
  }
};

exports.generateLitecoinAddress = async (publicKey) => {
  const pubKey = new litecore.PublicKey(publicKey);
  return pubKey.toAddress(network).toString();
};

exports.getLitecoinTransactionHistory = async (address) => {
  try {
    const response = await axios.get(`${LITECOIN_API_URL}/get_tx_received/LTCTEST/${address}`);
    return response.data.data.txs.map(tx => ({
      txid: tx.txid,
      amount: parseFloat(tx.value),
      confirmations: tx.confirmations,
      time: tx.time,
    }));
  } catch (error) {
    console.error('Failed to get Litecoin transaction history:', error);
    throw error;
  }
};

module.exports = exports;