const express = require('express');
const { register, login, updateEmail } = require('../controllers/authController');
const { createLightningChannel } = require('../controllers/LightningController.js')
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
      const { username, password, email, createBitcoin, createLitecoin, createLightning } = req.body;
  
      // Check if user already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
  
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create user object
      const user = new User({
        username,
        password: hashedPassword,
        email: email || undefined,
      });
  
      // Create wallets based on user selection
      if (createBitcoin) {
        user.bitcoinWallet = createBitcoinWallet();
      }
      if (createLitecoin) {
        user.litecoinWallet = createLitecoinWallet();
      }
      if (createLightning) {
        const lightningChannel = await createLightningChannel(1000, `Initial channel for ${username}`);
        user.lightningChannel = lightningChannel;
      }
  
      // Save user to database
      await user.save();
  
      // Send email backup if provided
      if (email) {
        await sendBackupEmail(email, user);
      }
  
      // Create and send JWT token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  
      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          username: user.username,
          email: user.email,
          bitcoinAddress: user.bitcoinWallet?.address,
          litecoinAddress: user.litecoinWallet?.address,
          lightningNodeId: user.lightningChannel?.nodeId,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
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
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  
      res.json({
        message: 'Login successful',
        token,
        user: {
          username: user.username,
          email: user.email,
          bitcoinAddress: user.bitcoinWallet?.address,
          litecoinAddress: user.litecoinWallet?.address,
          lightningNodeId: user.lightningChannel?.nodeId,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  module.exports = router;


module.exports = router;