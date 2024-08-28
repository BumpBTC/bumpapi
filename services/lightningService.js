const axios = require('axios');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const User = require('../models/User');

const LIGHTNING_API_URL = 'https://api.opennode.com/v1';
const OPENNODE_API_KEY = process.env.OPENNODE_API_KEY;

const lightningApi = axios.create({
  baseURL: LIGHTNING_API_URL,
  headers: {
    'Authorization': OPENNODE_API_KEY,
    'Content-Type': 'application/json'
  }
});

const testnetNodes = [
  '02df5ffe895c778e10f7742a6c5b8a0cefbe9465df58b92fadeb883752c8107c8f@3.33.236.230:9735',
  '0270685ca81a8e4d4d01beec5781f4cc924684072ae52c507f8ebe9daf0caaab7b@159.203.125.125:9735',
  '03ce09c8922b1aca0a43c869af2db821a9e12a3ca2c9eebc76e4d1e5e4c4c3d840@34.250.234.192:9735'
];

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
    const response = await lightningApi.get('/balance');
    return response.data.balance / 100000000; // Convert sats to BTC
  } catch (error) {
    console.error('Failed to get channel balance:', error);
    throw error;
  }
};

exports.createInvoice = async (walletId, amount, memo) => {
  try {
    const response = await lightningApi.post('/charges', {
      amount,
      description: memo,
      currency: 'BTC'
    });
    return {
      id: response.data.id,
      paymentRequest: response.data.lightning_invoice.payreq,
      description: response.data.description,
      amount: response.data.amount,
      createdAt: response.data.created_at
    };
  } catch (error) {
    console.error('Failed to create invoice:', error);
    throw error;
  }
};

exports.payInvoice = async (walletId, paymentRequest) => {
  try {
    const response = await lightningApi.post('/withdrawals', {
      type: 'ln',
      address: paymentRequest
    });
    return {
      id: response.data.id,
      status: response.data.status,
      amount: response.data.amount / 100000000 // Convert sats to BTC
    };
  } catch (error) {
    console.error('Failed to pay invoice:', error);
    throw error;
  }
};

exports.createLightningChannel = async (userId, amount, channelName, nodeUri) => {
  const updateProgress = async (progress) => {
    await User.findByIdAndUpdate(userId, { $set: { 'channelCreationProgress': progress } });
  };

  try {
    await updateProgress(0);
    let response;
    if (nodeUri) {
      await updateProgress(33);
      response = await lightningApi.post('/channels', {
        node_pubkey_string: nodeUri.split('@')[0],
        local_funding_amount: amount,
        push_sat: 0,
        private: false
      });
    } else {
      for (let i = 0; i < testnetNodes.length; i++) {
        try {
          await updateProgress((i + 1) * 33);
          response = await lightningApi.post('/channels', {
            node_pubkey_string: testnetNodes[i].split('@')[0],
            local_funding_amount: amount,
            push_sat: 0,
            private: false
          });
          nodeUri = testnetNodes[i];
          break;
        } catch (error) {
          console.error(`Failed to create channel with node ${i + 1}:`, error);
          if (i === testnetNodes.length - 1) {
            throw new Error('Failed to create channel with any available node');
          }
        }
      }
    }
    
    await updateProgress(100);
    
    const channel = {
      channelId: response.data.funding_txid_str,
      capacity: response.data.capacity,
      status: response.data.active ? 'active' : 'inactive',
      nodePubkey: nodeUri.split('@')[0],
      channelName: channelName
    };

    await User.findByIdAndUpdate(userId, {
      $push: { channelConfigurations: { name: channelName, nodeUri, amount, isFavorite: false } }
    });

    return channel;
  } catch (error) {
    await updateProgress(-1); // Indicate error
    throw error;
  }
};

exports.closeChannel = async (walletId, channelId) => {
  try {
    const response = await lightningApi.post(`/channels/${channelId}/close`);
    return {
      closingTxid: response.data.closing_txid,
      settledBalance: response.data.settled_balance / 100000000 // Convert sats to BTC
    };
  } catch (error) {
    console.error('Failed to close channel:', error);
    throw error;
  }
};

exports.getTransactionHistory = async (walletId) => {
  try {
    const response = await lightningApi.get('/withdrawals');
    return response.data.data.map(tx => ({
      id: tx.id,
      amount: tx.amount / 100000000, // Convert sats to BTC
      fee: tx.fee / 100000000,
      status: tx.status,
      createdAt: tx.created_at,
      type: tx.type
    }));
  } catch (error) {
    console.error('Failed to get transaction history:', error);
    throw error;
  }
};

exports.getChannelConfigurations = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.channelConfigurations || [];
  } catch (error) {
    console.error('Error getting channel configurations:', error);
    throw error;
  }
};

exports.updateChannelConfiguration = async (userId, configId, updates) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const config = user.channelConfigurations.id(configId);
    if (!config) {
      throw new Error('Channel configuration not found');
    }

    Object.assign(config, updates);
    await user.save();
    return config;
  } catch (error) {
    console.error('Error updating channel configuration:', error);
    throw error;
  }
};

exports.deleteChannelConfiguration = async (userId, configId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    user.channelConfigurations.id(configId).remove();
    await user.save();
  } catch (error) {
    console.error('Error deleting channel configuration:', error);
    throw error;
  }
};

exports.initLightning = async () => {
  // Initialize Lightning node connection
  console.log('Lightning node initialized');
};

module.exports = exports;