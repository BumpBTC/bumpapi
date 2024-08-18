const express = require('express');
const { 
  createLightningWallet, 
  importLightningWallet, 
  getLightningBalance, 
  createLightningInvoice, 
  payLightningInvoice,
  openLightningChannel,
  closeLightningChannel
} = require('../controllers/lightningController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/create-wallet', createLightningWallet);
router.post('/import-wallet', importLightningWallet);
router.get('/balance', getLightningBalance);
router.post('/create-invoice', createLightningInvoice);
router.post('/pay-invoice', payLightningInvoice);
router.post('/open-channel', openLightningChannel);
router.post('/close-channel', closeLightningChannel);

module.exports = router;