const lightningService = require('../services/lightningService');
const User = require('../models/User');

exports.createLightningWallet = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const wallet = await lightningService.createLightningWallet();
    
    user.wallets.push({
      type: 'lightning',
      address: wallet.walletId,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic
    });
    
    await user.save();
    
    res.json({ message: 'Lightning wallet created successfully', walletId: wallet.walletId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.importLightningWallet = async (req, res) => {
  try {
    const { mnemonic } = req.body;
    const user = await User.findById(req.userId);
    const wallet = await lightningService.importLightningWallet(mnemonic);
    
    user.wallets.push({
      type: 'lightning',
      address: wallet.walletId,
      privateKey: wallet.privateKey
    });
    
    await user.save();
    
    res.json({ message: 'Lightning wallet imported successfully', walletId: wallet.walletId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLightningBalance = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    
    if (!lightningWallet) {
      return res.status(404).json({ error: 'Lightning wallet not found' });
    }
    
    const balance = await lightningService.getChannelBalance(lightningWallet.address);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createLightningInvoice = async (req, res) => {
  try {
    const { amount, memo } = req.body;
    const user = await User.findById(req.userId);
    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    
    if (!lightningWallet) {
      return res.status(404).json({ error: 'Lightning wallet not found' });
    }
    
    const invoice = await lightningService.createInvoice(lightningWallet.address, amount, memo);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.payLightningInvoice = async (req, res) => {
  try {
    const { paymentRequest } = req.body;
    const user = await User.findById(req.userId);
    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    
    if (!lightningWallet) {
      return res.status(404).json({ error: 'Lightning wallet not found' });
    }
    
    const payment = await lightningService.payInvoice(lightningWallet.address, paymentRequest);
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.openLightningChannel = async (req, res) => {
  try {
    const { nodeUri, amount } = req.body;
    const user = await User.findById(req.userId);
    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    
    if (!lightningWallet) {
      return res.status(404).json({ error: 'Lightning wallet not found' });
    }
    
    const channel = await lightningService.openChannel(lightningWallet.address, nodeUri, amount);
    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.closeLightningChannel = async (req, res) => {
  try {
    const { channelId } = req.body;
    const user = await User.findById(req.userId);
    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    
    if (!lightningWallet) {
      return res.status(404).json({ error: 'Lightning wallet not found' });
    }
    
    const result = await lightningService.closeChannel(lightningWallet.address, channelId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLightningTransactionHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    if (!lightningWallet) {
      return res.status(404).json({ error: 'Lightning wallet not found' });
    }
    const history = await lightningService.getTransactionHistory(lightningWallet.walletId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Lightning transaction history' });
  }
};

exports.getChannelConfigurations = async (req, res) => {
  try {
    const configurations = await lightningService.getChannelConfigurations(req.userId);
    res.json(configurations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateChannelConfiguration = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedConfig = await lightningService.updateChannelConfiguration(req.userId, id, updates);
    res.json(updatedConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteChannelConfiguration = async (req, res) => {
  try {
    const { id } = req.params;
    await lightningService.deleteChannelConfiguration(req.userId, id);
    res.json({ message: 'Channel configuration deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;