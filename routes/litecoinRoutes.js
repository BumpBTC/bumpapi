const express = require('express');
const {
  getLitecoinWalletInfo,
  importLitecoinWallet,
  sendLitecoin,
  getLitecoinTransactionHistory,
  generateLitecoinAddress
} = require('../controllers/litecoinController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/info', getLitecoinWalletInfo);
router.post('/import', importLitecoinWallet);
router.post('/send', sendLitecoin);
router.get('/transaction-history', getLitecoinTransactionHistory);
router.get('/generate-address', generateLitecoinAddress);

module.exports = router;