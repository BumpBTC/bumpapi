const axios = require('axios');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');

const LIGHTNING_API_URL = 'https://api.opennode.com/v1';
const OPENNODE_API_KEY = process.env.OPENNODE_API_KEY;

const lightningApi = axios.create({
  baseURL: LIGHTNING_API_URL,
  headers: {
    'Authorization': OPENNODE_API_KEY,
    'Content-Type': 'application/json'
  }
});

exports.createLightningWallet = async () => {
  try {
    const mnemonic = bip39.generateMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bitcoin.bip32.fromSeed(seed);
    const child = root.derivePath("m/0'/0'/0'");
    const privateKey = child.privateKey.toString('hex');
    
    const response = await lightningApi.post('/wallets', {
      private_key: privateKey
    });

    return {
      walletId: response.data.id,
      privateKey: privateKey,
      mnemonic: mnemonic
    };
  } catch (error) {
    console.error('Failed to create Lightning wallet:', error);
    throw error;
  }
};

exports.importLightningWallet = async (mnemonic) => {
  try {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bitcoin.bip32.fromSeed(seed);
    const child = root.derivePath("m/0'/0'/0'");
    const privateKey = child.privateKey.toString('hex');
    
    const response = await lightningApi.post('/wallets', {
      private_key: privateKey
    });

    return {
      walletId: response.data.id,
      privateKey: privateKey
    };
  } catch (error) {
    console.error('Failed to import Lightning wallet:', error);
    throw error;
  }
};

exports.getChannelBalance = async (walletId) => {
  try {
    const response = await lightningApi.get(`/wallets/${walletId}/balance`);
    return response.data.balance / 100000000; // Convert sats to BTC
  } catch (error) {
    console.error('Failed to get channel balance:', error);
    throw error;
  }
};


exports.createInvoice = async (walletId, amount, memo) => {
  try {
    const response = await lightningApi.post(`/wallets/${walletId}/invoices`, {
      amount,
      description: memo,
      currency: 'BTC'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to create invoice:', error);
    throw error;
  }
};

exports.payInvoice = async (walletId, paymentRequest) => {
  try {
    const response = await lightningApi.post(`/wallets/${walletId}/pay`, {
      payment_request: paymentRequest
    });
    return response.data;
  } catch (error) {
    console.error('Failed to pay invoice:', error);
    throw error;
  }
};

exports.openChannel = async (walletId, nodeUri, amount) => {
  try {
    const response = await lightningApi.post(`/wallets/${walletId}/channels`, {
      node_uri: nodeUri,
      amount
    });
    return response.data;
  } catch (error) {
    console.error('Failed to open channel:', error);
    throw error;
  }
};

exports.closeChannel = async (walletId, channelId) => {
  try {
    const response = await lightningApi.post(`/wallets/${walletId}/channels/${channelId}/close`);
    return response.data;
  } catch (error) {
    console.error('Failed to close channel:', error);
    throw error;
  }
};

exports.getTransactionHistory = async (walletId) => {
  try {
    const response = await lightningApi.get(`/wallets/${walletId}/transactions`);
    return response.data.map(tx => ({
      id: tx.id,
      amount: tx.amount / 100000000, // Convert sats to BTC
      fee: tx.fee / 100000000,
      status: tx.status,
      timestamp: tx.created_at,
      type: tx.type,
    }));
  } catch (error) {
    console.error('Failed to get transaction history:', error);
    throw error;
  }
};

exports.initLightning = async () => {
  // Initialize Lightning node connection
  console.log('Lightning node initialized');
};

module.exports = exports;