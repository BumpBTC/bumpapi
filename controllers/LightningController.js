// lightningController.js

const User = require('../models/User');
const lightningService = require('../services/lightningService');

exports.createLightningWallet = async (req, res) => {
  try {
    const wallet = await lightningService.createLightningWallet();
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { 'walletTypes.lightning': true, 'lightningWallet': wallet } },
      { new: true }
    );
    res.status(201).json({ message: 'Lightning wallet created successfully', wallet });
  } catch (error) {
    console.error('Error creating Lightning wallet:', error);
    res.status(500).json({ message: 'Error creating Lightning wallet' });
  }
};

exports.importLightningWallet = async (req, res) => {
  try {
    const { mnemonic } = req.body;
    const wallet = await lightningService.importLightningWallet(mnemonic);
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { 'walletTypes.lightning': true, 'lightningWallet': wallet } },
      { new: true }
    );
    res.status(200).json({ message: 'Lightning wallet imported successfully', wallet });
  } catch (error) {
    console.error('Error importing Lightning wallet:', error);
    res.status(500).json({ message: 'Error importing Lightning wallet' });
  }
};

exports.getLightningBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const balance = await lightningService.getChannelBalance(user.lightningWallet.walletId);
    res.json({ balance });
  } catch (error) {
    console.error('Error getting Lightning balance:', error);
    res.status(500).json({ message: 'Error getting Lightning balance' });
  }
};

exports.createLightningInvoice = async (req, res) => {
  try {
    const { amount, memo } = req.body;
    const user = await User.findById(req.user.userId);
    const invoice = await lightningService.createInvoice(user.lightningWallet.walletId, amount, memo);
    res.json(invoice);
  } catch (error) {
    console.error('Error creating Lightning invoice:', error);
    res.status(500).json({ message: 'Error creating Lightning invoice' });
  }
};

exports.payLightningInvoice = async (req, res) => {
  try {
    const { paymentRequest } = req.body;
    const user = await User.findById(req.user.userId);
    const payment = await lightningService.payInvoice(user.lightningWallet.walletId, paymentRequest);
    res.json(payment);
  } catch (error) {
    console.error('Error paying Lightning invoice:', error);
    res.status(500).json({ message: 'Error paying Lightning invoice' });
  }
};

exports.createLightningChannel = async (req, res) => {
  try {
    const { amount, channelName, nodeUri } = req.body;
    const channel = await lightningService.createLightningChannel(req.user.userId, amount, channelName, nodeUri);
    res.status(201).json(channel);
  } catch (error) {
    console.error('Error creating Lightning channel:', error);
    res.status(500).json({ message: 'Error creating Lightning channel' });
  }
};

exports.closeLightningChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const user = await User.findById(req.user.userId);
    const result = await lightningService.closeChannel(user.lightningWallet.walletId, channelId);
    res.json(result);
  } catch (error) {
    console.error('Error closing Lightning channel:', error);
    res.status(500).json({ message: 'Error closing Lightning channel' });
  }
};

exports.getLightningTransactionHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const history = await lightningService.getTransactionHistory(user.lightningWallet.walletId);
    res.json(history);
  } catch (error) {
    console.error('Error getting Lightning transaction history:', error);
    res.status(500).json({ message: 'Error getting Lightning transaction history' });
  }
};

exports.getChannelConfigurations = async (req, res) => {
  try {
    const configurations = await lightningService.getChannelConfigurations(req.user.userId);
    res.json(configurations);
  } catch (error) {
    console.error('Error getting channel configurations:', error);
    res.status(500).json({ message: 'Error getting channel configurations' });
  }
};

exports.updateChannelConfiguration = async (req, res) => {
  try {
    const { configId } = req.params;
    const updates = req.body;
    const updatedConfig = await lightningService.updateChannelConfiguration(req.user.userId, configId, updates);
    res.json(updatedConfig);
  } catch (error) {
    console.error('Error updating channel configuration:', error);
    res.status(500).json({ message: 'Error updating channel configuration' });
  }
};

exports.deleteChannelConfiguration = async (req, res) => {
  try {
    const { configId } = req.params;
    await lightningService.deleteChannelConfiguration(req.user.userId, configId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting channel configuration:', error);
    res.status(500).json({ message: 'Error deleting channel configuration' });
  }
};


module.exports = exports;