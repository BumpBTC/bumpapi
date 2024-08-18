const litecoinService = require('../services/litecoinService');
const User = require('../models/User');

exports.getLitecoinWalletInfo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const litecoinWallet = user.wallets.find(w => w.type === 'litecoin');
    if (!litecoinWallet) {
      return res.status(404).json({ error: 'Litecoin wallet not found' });
    }
    const balance = await litecoinService.getLitecoinBalance(litecoinWallet.address);
    res.json({ address: litecoinWallet.address, balance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Litecoin wallet info' });
  }
};

exports.importLitecoinWallet = async (req, res) => {
  try {
    const { mnemonic, privateKey } = req.body;
    const wallet = await litecoinService.generateLitecoinWallet(mnemonic, privateKey);
    const user = await User.findById(req.userId);
    user.wallets.push(wallet);
    await user.save();
    res.json({ message: 'Litecoin wallet imported successfully', wallet });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import Litecoin wallet' });
  }
};

exports.sendLitecoin = async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const user = await User.findById(req.userId);
    const litecoinWallet = user.wallets.find(w => w.type === 'litecoin');
    if (!litecoinWallet) {
      return res.status(404).json({ error: 'Litecoin wallet not found' });
    }
    const txid = await litecoinService.sendLitecoin(litecoinWallet.address, toAddress, amount, litecoinWallet.privateKey);
    res.json({ txid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send Litecoin' });
  }
};

exports.getLitecoinTransactionHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const litecoinWallet = user.wallets.find(w => w.type === 'litecoin');
    if (!litecoinWallet) {
      return res.status(404).json({ error: 'Litecoin wallet not found' });
    }
    const history = await litecoinService.getLitecoinTransactionHistory(litecoinWallet.address);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Litecoin transaction history' });
  }
};

exports.generateLitecoinAddress = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const litecoinWallet = user.wallets.find(w => w.type === 'litecoin');
    if (!litecoinWallet) {
      return res.status(404).json({ error: 'Litecoin wallet not found' });
    }
    const newAddress = await litecoinService.generateLitecoinAddress(litecoinWallet.publicKey);
    res.json({ address: newAddress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate new Litecoin address' });
  }
};

module.exports = exports;