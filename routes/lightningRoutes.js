// lightningRoutes.js

const express = require('express');
const {
  createLightningWallet,
  importLightningWallet,
  getLightningBalance,
  createLightningInvoice,
  payLightningInvoice,
  createLightningChannel,
  closeLightningChannel,
  getLightningTransactionHistory,
  getChannelConfigurations,
  updateChannelConfiguration,
  deleteChannelConfiguration
} = require('../controllers/lightningController');
const {
  createNfcChannel,
  getNfcChannelBalance,
  createNfcInvoice,
  payNfcInvoice
} = require('../services/lightningService');

const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/create-wallet', createLightningWallet);
router.post('/import-wallet', importLightningWallet);
router.get('/balance', getLightningBalance);
router.post('/create-invoice', createLightningInvoice);
router.post('/pay-invoice', payLightningInvoice);
router.post('/create-channel', createLightningChannel);
router.post('/close-channel/:channelId', closeLightningChannel);
router.get('/transaction-history', getLightningTransactionHistory);
router.get('/channel-configurations', getChannelConfigurations);
router.put('/channel-configurations/:configId', updateChannelConfiguration);
router.delete('/channel-configurations/:configId', deleteChannelConfiguration);

router.post('/create-nfc-channel', createNfcChannel);
router.get('/nfc-channel-balance', getNfcChannelBalance);
router.post('/create-nfc-invoice', createNfcInvoice);
router.post('/pay-nfc-invoice', payNfcInvoice);

module.exports = router;