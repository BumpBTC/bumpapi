const User = require('../models/User');
const { getBalance, sendTransaction, generateWallet, generateAddress, sendBitcoinTransaction } = require('../services/bitcoinService');
const { getChannelBalance, createInvoice, payInvoice, createLightningWallet, sendLightningPayment } = require('../services/lightningService');
const { generateLitecoinWallet, getLitecoinBalance, sendLitecoin, generateLitecoinAddress, sendLitecoinTransaction } = require('../services/litecoinService');
const bitcoinService = require('../services/bitcoinService');
const lightningService = require('../services/lightningService');
const litecoinService = require('../services/litecoinService');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

exports.getWalletInfo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const walletInfo = await Promise.all(user.wallets.map(async (wallet) => {
      let balance = 0;
      let address = wallet.address;
      switch (wallet.type) {
        case 'bitcoin':
          balance = await getBalance(wallet.address);
          address = await generateAddress(wallet.publicKey);
          break;
        case 'lightning':
          balance = await getChannelBalance(wallet.publicKey);
          break;
        case 'litecoin':
          balance = await getLitecoinBalance(wallet.address);
          address = await generateLitecoinAddress(wallet.publicKey);
          break;
      }
      return { ...wallet.toObject(), balance, currentAddress: address };
    }));

    res.json({ wallets: walletInfo, transactions: user.transactions });
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.importWallet = async (req, res) => {
  try {
    const { mnemonic, privateKey, type } = req.body;
    let wallet;
    switch (type) {
      case 'bitcoin':
        wallet = await bitcoinService.generateWallet(mnemonic, privateKey);
        break;
      case 'lightning':
        wallet = await lightningService.createLightningWallet(mnemonic);
        break;
      case 'litecoin':
        wallet = await litecoinService.generateLitecoinWallet(mnemonic, privateKey);
        break;
      default:
        return res.status(400).json({ error: 'Invalid wallet type' });
    }
    const user = await User.findById(req.userId);
    user.wallets.push(wallet);
    await user.save();
    res.json({ message: 'Wallet imported successfully', wallet });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import wallet' });
  }
};

exports.getAccountDetails = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const accountDetails = user.wallets.map(wallet => ({
      type: wallet.type,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      address: wallet.address,
      mnemonic: wallet.mnemonic
    }));
    res.json({ accountDetails });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account details' });
  }
};

exports.removeAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Account removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove account' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    // Here you would typically send a password reset email
    // For this example, we'll just return a success message
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate password reset' });
  }
};

exports.sendTransaction = async (req, res) => {
  try {
    const { currency, toAddress, amount } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const wallet = user.wallets.find(w => w.type.toLowerCase() === currency.toLowerCase());
    if (!wallet) {
      return res.status(400).json({ error: `${currency} wallet not found for this user` });
    }

    let txid;
    switch (currency.toLowerCase()) {
      case 'bitcoin':
        txid = await sendBitcoinTransaction(wallet.address, toAddress, amount, wallet.privateKey);
        break;
      case 'lightning':
        txid = await sendLightningPayment(wallet.publicKey, toAddress, amount);
        break;
      case 'litecoin':
        txid = await sendLitecoinTransaction(wallet.address, toAddress, amount, wallet.privateKey);
        break;
      default:
        return res.status(400).json({ error: 'Invalid currency' });
    }

    const transaction = {
      type: 'send',
      amount,
      address: toAddress,
      status: 'completed',
      walletType: currency.toLowerCase(),
      txid,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ txid, transaction });
  } catch (error) {
    console.error('Error sending transaction:', error);
    res.status(500).json({ error: 'Failed to send transaction' });
  }
};

exports.sendBitcoin = async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const bitcoinWallet = user.wallets.find(w => w.type === 'bitcoin');
    if (!bitcoinWallet) {
      const newWallet = await bitcoinService.generateWallet();
      user.wallets.push(newWallet);
      await user.save();
      return res.status(400).json({ error: 'Bitcoin wallet created. Please try sending again.' });
    }

    if (!bitcoinWallet.privateKey || bitcoinWallet.privateKey.length !== 64) {
      console.error('Invalid private key:', bitcoinWallet.privateKey);
      return res.status(400).json({ error: 'Invalid private key' });
    }

    const txid = await bitcoinService.sendTransaction(bitcoinWallet.address, toAddress, amount, bitcoinWallet.privateKey);
    
    const transaction = {
      type: 'send',
      amount,
      address: toAddress,
      status: 'completed',
      walletType: 'bitcoin',
      txid,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ txid, transaction });
  } catch (error) {
    console.error('Error sending Bitcoin:', error);
    res.status(500).json({ error: 'Failed to send Bitcoin', details: error.message });
  }
};

exports.sendLitecoin = async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const litecoinWallet = user.wallets.find(w => w.type === 'litecoin');
    if (!litecoinWallet) {
      return res.status(400).json({ error: 'Litecoin wallet not found for this user' });
    }

    const txid = await sendLitecoin(litecoinWallet.address, toAddress, amount, litecoinWallet.privateKey);
    
    const transaction = {
      type: 'send',
      amount,
      address: toAddress,
      status: 'completed',
      walletType: 'litecoin',
      txid,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ txid, transaction });
  } catch (error) {
    console.error('Error sending Litecoin:', error);
    res.status(500).json({ error: 'Failed to send Litecoin' });
  }
};

exports.sendLightning = async (req, res) => {
  try {
    const { paymentRequest } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    if (!lightningWallet) {
      return res.status(400).json({ error: 'Lightning wallet not found for this user' });
    }

    const payment = await payInvoice(lightningWallet.publicKey, paymentRequest);
    
    const transaction = {
      type: 'send',
      amount: payment.tokens,
      address: payment.destination,
      status: 'completed',
      walletType: 'lightning',
      paymentHash: payment.id,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ payment, transaction });
  } catch (error) {
    console.error('Error sending Lightning payment:', error);
    res.status(500).json({ error: 'Failed to send Lightning payment' });
  }
};

exports.createLightningInvoice = async (req, res) => {
  try {
    const { amount, memo } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const lightningWallet = user.wallets.find(w => w.type === 'lightning');
    if (!lightningWallet) {
      return res.status(400).json({ error: 'Lightning wallet not found for this user' });
    }

    const invoice = await createInvoice(lightningWallet.publicKey, amount, memo);
    res.json(invoice);
  } catch (error) {
    console.error('Error creating Lightning invoice:', error);
    res.status(500).json({ error: 'Failed to create Lightning invoice' });
  }
};

exports.updateSecurityLevel = async (req, res) => {
  try {
    const { level } = req.body;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    switch (level) {
      case 2:
        if (!user.email) {
          return res.status(400).json({ error: 'Email is required for this security level' });
        }
        break;
      case 3:
        if (!user.phoneNumber) {
          return res.status(400).json({ error: 'Phone number is required for this security level' });
        }
        break;
      case 4:
        if (!user.email || !user.phoneNumber) {
          return res.status(400).json({ error: 'Both email and phone number are required for this security level' });
        }
        break;
      case 5:
        if (!user.totpSecret) {
          const secret = speakeasy.generateSecret();
          user.totpSecret = secret.base32;
          const otpAuthUrl = speakeasy.otpauthURL({
            secret: secret.base32,
            label: 'CryptoWallet',
            issuer: 'YourAppName'
          });
          const qr = await qrcode.toDataURL(otpAuthUrl);
          return res.json({ securityLevel: level, totpSecret: user.totpSecret, qrCode: qr });
        }
        break;
      case 6:
        if (!user.hardwareKeyId) {
          return res.status(400).json({ error: 'Hardware key setup is required for this security level' });
        }
        break;
    }

    user.securityLevel = level;
    await user.save();

    res.json({ securityLevel: user.securityLevel });
  } catch (error) {
    console.error('Error updating security level:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.backupWallet = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const backupData = user.wallets.map(wallet => ({
      type: wallet.type,
      mnemonic: wallet.mnemonic,
      privateKey: wallet.privateKey,
    }));

    res.json({ backupData });
  } catch (error) {
    console.error('Error creating wallet backup:', error);
    res.status(500).json({ error: 'Failed to create wallet backup' });
  }
};

exports.restoreWallet = async (req, res) => {
  try {
    const { backupData } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    for (const walletData of backupData) {
      let wallet;
      switch (walletData.type) {
        case 'bitcoin':
          wallet = await generateWallet(walletData.mnemonic);
          break;
        case 'lightning':
          wallet = await createLightningWallet(walletData.mnemonic);
          break;
        case 'litecoin':
          wallet = await generateLitecoinWallet(walletData.mnemonic);
          break;
        default:
          continue;
      }
      user.wallets.push(wallet);
    }
    await user.save();

    res.json({ message: 'Wallets restored successfully', wallets: user.wallets });
  } catch (error) {
    console.error('Error restoring wallets:', error);
    res.status(500).json({ error: 'Failed to restore wallets' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ transactions: user.transactions });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
};

exports.updateAccountSettings = async (req, res) => {
  try {
    const { email, phoneNumber, preferredCurrency } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (preferredCurrency) user.preferredCurrency = preferredCurrency;

    await user.save();
    res.json({ message: 'Account settings updated successfully', user });
  } catch (error) {
    console.error('Error updating account settings:', error);
    res.status(500).json({ error: 'Failed to update account settings' });
  }
};

module.exports = exports;