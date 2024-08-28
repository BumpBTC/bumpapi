const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { register, login, updateEmail } = require('../controllers/authController');
const { generateWallet } = require('../services/bitcoinService');
const { createLightningChannel } = require('../controllers/lightningController')
const router = express.Router();

router.post('/register', register);
// router.post('/login', login);
router.post('/update-email', updateEmail);

async function sendBackupEmail(email, user) {
    try {
      await emailjs.send(
        EMAILJS_SERVICEID,
        EMAILJS_SERVICEID,
        {
          to_email: email,
          username: user.username,
          bitcoin_address: user.bitcoinWallet?.address,
          litecoin_address: user.litecoinWallet?.address,
          lightning_node_id: user.lightningChannel?.nodeId,
        },
        {
          publicKey: EMAILJS_PUBLIC,
          privateKey: EMAILJS_PRIVATE,
        }
      );
      console.log('Backup email sent successfully');
    } catch (error) {
      console.error('Error sending backup email:', error);
    }
  }

  router.post('/signup', async (req, res) => {
    try {
      const { username, email, password } = req.body;
  
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const bitcoinWallet = await generateWallet();
  
      const user = new User({
        username,
        email,
        password: hashedPassword,
        wallets: [{
          type: 'bitcoin',
          address: bitcoinWallet.address,
          privateKey: bitcoinWallet.privateKey,
          publicKey: bitcoinWallet.publicKey,
          mnemonic: bitcoinWallet.mnemonic,
          balance: 0,
          isActive: true
        }]
      });
  
      await user.save();
  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      // Changed this part to safely access the first wallet
      const firstWallet = user.wallets && user.wallets.length > 0 ? user.wallets[0] : null;
  
      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          username: user.username,
          email: user.email,
          wallets: firstWallet ? [{
            type: firstWallet.type,
            address: firstWallet.address,
            balance: firstWallet.balance
          }] : []
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Server error', details: error.message });
    }
  });
  
  
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Find user by username
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      // Create and send JWT token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      res.json({
        message: 'Login successful',
        token,
        user: {
          username: user.username,
          email: user.email,
          bitcoinAddress: user.wallets[0]?.address,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

module.exports = router;