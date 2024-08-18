const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { generateBitcoinWallet } = require("../services/bitcoinService");
const { createLightningWallet } = require("../services/lightningService");

exports.register = async (req, res) => {
  try {
    const { username, email, password, walletTypes } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email or username already exists" });
    }

    const user = new User({ username, email, password });

    if (walletTypes.bitcoin) {
      const bitcoinWallet = generateBitcoinWallet();
      user.wallets.push({
        type: "bitcoin",
        address: bitcoinWallet.address,
        publicKey: bitcoinWallet.publicKey,
        privateKey: bitcoinWallet.privateKey,
      });
    }

    if (walletTypes.lightning) {
      const lightningWallet = await createLightningWallet();
      user.wallets.push({
        type: "lightning",
        publicKey: lightningWallet.publicKey,
      });
    }

    await user.save();
    const verificationToken = crypto.randomBytes(20).toString("hex");
    user.verificationToken = verificationToken;
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

       // Send verification email
       const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
       await sendEmail(user.email, 'Verify Your Email', `Please click this link to verify your email: ${verificationUrl}`);
   
       res.status(201).json({  });

    res.status(201).json({
      token,
      user: {
        username: user.username,
        email: user.email,
        message: 'User registered successfully. Please check your email to verify your account.',
        wallets: user.wallets.map((wallet) => ({
          type: wallet.type,
          address: wallet.address,
          publicKey: wallet.publicKey,
        })),
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

    if (!user.isVerified) {
      return res.status(400).json({ error: 'Please verify your email before logging in' });
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

module.exports = exports;