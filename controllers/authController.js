const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { generateWallet } = require("../services/bitcoinService");
const { createLightningWallet } = require("../services/lightningService");
const { createLightningChannel } = require("../services/lightningService");
const { generateLitecoinWallet } = require("../services/litecoinService");

exports.register = async (req, res) => {
  try {
    const { username, password, email, walletType } = req.body;

    if (!username || !password || !walletType) {
      return res.status(400).json({ error: "Username, password, and wallet type are required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "User with this username already exists" });
    }

    const user = new User({ username, password, email });

    let wallet;
    switch (walletType) {
      case "bitcoin":
        wallet = generateWallet();
        break;
      case "lightning":
        wallet = await createLightningWallet();
        break;
      case "litecoin":
        wallet = generateLitecoinWallet();
        break;
      default:
        return res.status(400).json({ error: "Invalid wallet type" });
    }

    // if (walletTypes.bitcoin) {
    //   const bitcoinWallet = generateWallet();
    //   user.wallets.push({
    //     type: "bitcoin",
    //     address: bitcoinWallet.address,
    //     publicKey: bitcoinWallet.publicKey,
    //     privateKey: bitcoinWallet.privateKey,
    //   });
    // }

    // if (walletTypes.lightning) {
    //   const lightningWallet = await createLightningWallet();
    //   user.wallets.push({
    //     type: "lightning",
    //     publicKey: lightningWallet.publicKey,
    //   });
    // }

    // if (walletTypes.litecoin) {
    //   const litecoinWallet = generateLitecoinWallet();
    //   user.wallets.push({
    //     type: "litecoin",
    //     address: litecoinWallet.address,
    //     publicKey: litecoinWallet.publicKey,
    //     privateKey: litecoinWallet.privateKey,
    //   });
    // }

    user.wallets.push({
      type: walletType,
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
    });

    user.activeWallet = walletType;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    if (email) {
      // TODO: Implement email backup functionality
      const backupInfo = user.wallets.map(wallet => ({
        type: wallet.type,
        address: wallet.address,
        publicKey: wallet.publicKey,
      }));
      await sendEmail(email, "Wallet Backup Information", JSON.stringify(backupInfo, null, 2));
    }

    res.status(201).json({
      token,
      user: {
        username: user.username,
        email: user.email,
        wallet: {
          type: walletType,
          address: wallet.address,
          publicKey: wallet.publicKey,
        },
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: "Invalid login credentials" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({
      token,
      user: {
        username: user.username,
        email: user.email,
        wallets: user.wallets,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.userId; // Assuming you have middleware that sets this

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.email = email || null; // Set to null if email is empty string
    await user.save();

    res.json({ message: "Email updated successfully" });
  } catch (error) {
    console.error("Email update error:", error);
    res.status(500).json({ error: "Failed to update email" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendEmail(user.email, 'Password Reset', `Please click this link to reset your password: ${resetUrl}`);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.completeSignup = async (req, res) => {
  try {
    const { backedUp, email } = req.body;
    const userId = req.userId; // Assuming you have middleware that sets this

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.backedUp = backedUp;
    user.email = email || user.email;
    await user.save();

    if (email && backedUp) {
      const wallet = user.wallets.find(w => w.type === user.activeWallet);
      const backupInfo = {
        type: wallet.type,
        address: wallet.address,
        publicKey: wallet.publicKey,
      };
      await sendEmail(email, "Wallet Backup Information", JSON.stringify(backupInfo, null, 2));
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: { username: user.username, email: user.email, activeWallet: user.activeWallet } });
  } catch (error) {
    console.error("Complete signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = exports;