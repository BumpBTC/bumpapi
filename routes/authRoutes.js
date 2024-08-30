const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { signup, login } = require('../controllers/authController');
const { generateWallet } = require('../services/bitcoinService');
const { createLightningChannel } = require('../controllers/lightningController')
const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

module.exports = router;