const User = require("../models/User");
const bitcoin = require('bitcoinjs-lib');
const Transaction = require('../models/User');
const {
  getBalance,
  sendTransaction,
  generateWallet,
  bitcoinWallet,
  generateAddress,
  sendBitcoinTransaction,
} = require("../services/bitcoinService");
const {
  getChannelBalance,
  createInvoice,
  payInvoice,
  createLightningWallet,
  sendLightningPayment,
} = require("../services/lightningService");
const {
  generateLitecoinWallet,
  getLitecoinBalance,
  sendLitecoin,
  generateLitecoinAddress,
  sendLitecoinTransaction,
} = require("../services/litecoinService");
const bitcoinService = require("../services/bitcoinService");
const lightningService = require("../services/lightningService");
const litecoinService = require("../services/litecoinService");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

exports.getWalletInfo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const walletInfo = await Promise.all(
      user.wallets.map(async (wallet) => {
        let balance = 0;
        let address = wallet.address;
        switch (wallet.type) {
          case "bitcoin":
            balance = await bitcoinService.getBalance(wallet.address);
            break;
          case "lightning":
            balance = await getChannelBalance(wallet.publicKey);
            break;
          case "litecoin":
            balance = await bitcoinService.getBalance(wallet.address);
            break;
        }
        return {
          id: wallet._id,
          type: wallet.type,
          address: address,
          balance,
          isActive: wallet.isActive
        };
      })
    );

    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({ wallets: walletInfo, transactions });
  } catch (error) {
    console.error("Error fetching wallet info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.importWallet = async (req, res) => {
  try {
    const { mnemonic, privateKey, type } = req.body;
    const user = await User.findById(req.userId);

    let importedWallet;
    switch (type) {
      case "bitcoin":
        importedWallet = await bitcoinService.importWallet(mnemonic);
        break;
      case "litecoin":
        importedWallet = await litecoinService.importWallet(mnemonic);
        break;
      default:
        return res.status(400).json({ error: "Invalid wallet type" });
    }

    importedWallet.isActive = !user.wallets.some((w) => w.type === type);
    user.wallets.push(importedWallet);
    await user.save();

    res.json({
      message: "Wallet imported successfully",
      wallet: importedWallet,
    });
  } catch (error) {
    console.error("Error importing wallet:", error);
    res.status(500).json({ error: "Failed to import wallet" });
  }
};

exports.getAccountDetails = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const accountDetails = user.wallets.map((wallet) => ({
      type: wallet.type,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      address: wallet.address,
      mnemonic: wallet.mnemonic,
    }));
    res.json({ accountDetails });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch account details" });
  }
};

exports.removeWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const user = await User.findById(req.userId);

    const walletIndex = user.wallets.findIndex(
      (w) => w._id.toString() === walletId
    );
    if (walletIndex === -1) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    user.wallets.splice(walletIndex, 1);
    await user.save();

    res.json({ message: "Wallet removed successfully" });
  } catch (error) {
    console.error("Error removing wallet:", error);
    res.status(500).json({ error: "Failed to remove wallet" });
  }
};

exports.removeAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Account removed successfully" });
  } catch (error) {
    console.error("Error removing account:", error);
    res.status(500).json({ error: "Failed to remove account" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

exports.setActiveWallet = async (req, res) => {
  try {
    const { type, walletId } = req.body;
    const user = await User.findById(req.userId);

    const wallet = user.wallets.id(walletId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    user.activeWallets[type] = walletId;
    await user.save();

    res.json({ message: 'Active wallet updated successfully' });
  } catch (error) {
    console.error('Error setting active wallet:', error);
    res.status(500).json({ error: 'Failed to set active wallet' });
  }
};

exports.sendTransaction = async (req, res) => {
  try {
    const { currency, toAddress, amount } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const wallet = user.wallets.find(
      (w) => w.type.toLowerCase() === currency.toLowerCase()
    );
    if (!wallet) {
      return res
        .status(400)
        .json({ error: `${currency} wallet not found for this user` });
    }

    let txid;
    switch (currency.toLowerCase()) {
      case "bitcoin":
        txid = await sendBitcoinTransaction(
          wallet.address,
          toAddress,
          amount,
          wallet.privateKey
        );
        break;
      case "lightning":
        txid = await sendLightningPayment(wallet.publicKey, toAddress, amount);
        break;
      case "litecoin":
        txid = await sendLitecoinTransaction(
          wallet.address,
          toAddress,
          amount,
          wallet.privateKey
        );
        break;
      default:
        return res.status(400).json({ error: "Invalid currency" });
    }

    const transaction = {
      type: "send",
      amount,
      address: toAddress,
      status: "completed",
      walletType: currency.toLowerCase(),
      txid,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ txid, transaction });
  } catch (error) {
    console.error("Error sending transaction:", error);
    res.status(500).json({ error: "Failed to send transaction" });
  }
};

exports.sendBitcoin = async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const user = await User.findById(req.userId);

    const bitcoinWallet = user.wallets.find(
      (w) => w.type === "bitcoin" && w.isActive
    );
    if (!bitcoinWallet) {
      return res.status(404).json({ error: "No active Bitcoin wallet found" });
    }

    const txid = await bitcoinService.sendTransaction(
      bitcoinWallet.address,
      toAddress,
      amount,
      bitcoinWallet.privateKey
    );

    const transaction = {
      type: "send",
      amount,
      address: toAddress,
      status: "completed",
      walletType: "bitcoin",
      txid,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ txid, transaction });
  } catch (error) {
    console.error("Error sending Bitcoin:", error);
    res
      .status(500)
      .json({ error: "Failed to send Bitcoin", details: error.message });
  }
};

exports.sendLitecoin = async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const litecoinWallet = user.wallets.find((w) => w.type === "litecoin");
    if (!litecoinWallet) {
      return res
        .status(400)
        .json({ error: "Litecoin wallet not found for this user" });
    }

    const txid = await sendLitecoin(
      litecoinWallet.address,
      toAddress,
      amount,
      litecoinWallet.privateKey
    );

    const transaction = {
      type: "send",
      amount,
      address: toAddress,
      status: "completed",
      walletType: "litecoin",
      txid,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ txid, transaction });
  } catch (error) {
    console.error("Error sending Litecoin:", error);
    res.status(500).json({ error: "Failed to send Litecoin" });
  }
};

exports.sendLightning = async (req, res) => {
  try {
    const { paymentRequest } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const lightningWallet = user.wallets.find((w) => w.type === "lightning");
    if (!lightningWallet) {
      return res
        .status(400)
        .json({ error: "Lightning wallet not found for this user" });
    }

    const payment = await payInvoice(lightningWallet.publicKey, paymentRequest);

    const transaction = {
      type: "send",
      amount: payment.tokens,
      address: payment.destination,
      status: "completed",
      walletType: "lightning",
      paymentHash: payment.id,
    };
    user.transactions.push(transaction);
    await user.save();

    res.json({ payment, transaction });
  } catch (error) {
    console.error("Error sending Lightning payment:", error);
    res.status(500).json({ error: "Failed to send Lightning payment" });
  }
};

exports.createBitcoinWallet = async () => {
  try {
    const wallet = await generateWallet();
    return {
      type: 'bitcoin',
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic,
    };
  } catch (error) {
    console.error("Error creating Bitcoin wallet:", error);
    throw error;
  }
};

exports.createLitecoinWallet = async (req, res) => {
  const privateKey = new litecoin.PrivateKey();
  const address = privateKey.toAddress().toString();
  return { address, privateKey: privateKey.toString() };
};

exports.createWallet = async (req, res) => {
  try {
    const { type } = req.body;
    const user = await User.findById(req.userId);

    if (user.wallets.some((w) => w.type === type)) {
      return res.status(400).json({ error: `${type} wallet already exists` });
    }

    let newWallet;
    switch (type) {
      case "bitcoin":
        newWallet = await bitcoinService.generateWallet();
        break;
      case "litecoin":
        newWallet = await litecoinService.generateLitecoinWallet();
        break;
      case "lightning":
        newWallet = await lightningService.createLightningWallet();
        break;
      default:
        return res.status(400).json({ error: "Invalid wallet type" });
    }

    if (!newWallet.address) {
      return res
        .status(500)
        .json({ error: "Failed to generate wallet address" });
    }

    newWallet.isActive = true;
    // user.wallets.forEach((wallet) => {
    //   if (wallet.type === type) {
    //     wallet.isActive = false;
    //   }
    // });
    user.wallets.push(newWallet);

    user.activeWallets[type] = newWallet._id;

    await user.save();

    res.json({
      message: `${type} wallet created successfully`,
      wallet: newWallet,
    });
  } catch (error) {
    console.error("Error creating wallet:", error);
    res.status(500).json({ error: "Failed to create wallet" });
  }
};

exports.createLightningInvoice = async (req, res) => {
  try {
    const { amount, memo } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const lightningWallet = user.wallets.find((w) => w.type === "lightning");
    if (!lightningWallet) {
      return res
        .status(400)
        .json({ error: "Lightning wallet not found for this user" });
    }

    const invoice = await createInvoice(
      lightningWallet.publicKey,
      amount,
      memo
    );
    res.json(invoice);
  } catch (error) {
    console.error("Error creating Lightning invoice:", error);
    res.status(500).json({ error: "Failed to create Lightning invoice" });
  }
};

exports.updateSecurityLevel = async (req, res) => {
  try {
    const { level } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    switch (level) {
      case 2:
        if (!user.email) {
          return res
            .status(400)
            .json({ error: "Email is required for this security level" });
        }
        break;
      case 3:
        if (!user.phoneNumber) {
          return res.status(400).json({
            error: "Phone number is required for this security level",
          });
        }
        break;
      case 4:
        if (!user.email || !user.phoneNumber) {
          return res.status(400).json({
            error:
              "Both email and phone number are required for this security level",
          });
        }
        break;
      case 5:
        if (!user.totpSecret) {
          const secret = speakeasy.generateSecret();
          user.totpSecret = secret.base32;
          const otpAuthUrl = speakeasy.otpauthURL({
            secret: secret.base32,
            label: "CryptoWallet",
            issuer: "YourAppName",
          });
          const qr = await qrcode.toDataURL(otpAuthUrl);
          return res.json({
            securityLevel: level,
            totpSecret: user.totpSecret,
            qrCode: qr,
          });
        }
        break;
      case 6:
        if (!user.hardwareKeyId) {
          return res.status(400).json({
            error: "Hardware key setup is required for this security level",
          });
        }
        break;
    }

    user.securityLevel = level;
    await user.save();

    res.json({ securityLevel: user.securityLevel });
  } catch (error) {
    console.error("Error updating security level:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.backupWallet = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const backupData = user.wallets.map((wallet) => ({
      type: wallet.type,
      mnemonic: wallet.mnemonic,
      privateKey: wallet.privateKey,
    }));

    res.json({ backupData });
  } catch (error) {
    console.error("Error creating wallet backup:", error);
    res.status(500).json({ error: "Failed to create wallet backup" });
  }
};

exports.restoreWallet = async (req, res) => {
  try {
    const { backupData } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    for (const walletData of backupData) {
      let wallet;
      switch (walletData.type) {
        case "bitcoin":
          wallet = await generateWallet(walletData.mnemonic);
          break;
        case "lightning":
          wallet = await createLightningWallet(walletData.mnemonic);
          break;
        case "litecoin":
          wallet = await generateLitecoinWallet(walletData.mnemonic);
          break;
        default:
          continue;
      }
      user.wallets.push(wallet);
    }
    await user.save();

    res.json({
      message: "Wallets restored successfully",
      wallets: user.wallets,
    });
  } catch (error) {
    console.error("Error restoring wallets:", error);
    res.status(500).json({ error: "Failed to restore wallets" });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const bitcoinTransactions = user.transactions.filter(
      (tx) => tx.walletType === "bitcoin"
    );
    res.json({ transactions: bitcoinTransactions });
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({ error: "Failed to fetch transaction history" });
  }
};

exports.updateAccountSettings = async (req, res) => {
  try {
    const { email, phoneNumber, preferredCurrency } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (preferredCurrency) user.preferredCurrency = preferredCurrency;

    await user.save();
    res.json({ message: "Account settings updated successfully", user });
  } catch (error) {
    console.error("Error updating account settings:", error);
    res.status(500).json({ error: "Failed to update account settings" });
  }
};

module.exports = exports;
