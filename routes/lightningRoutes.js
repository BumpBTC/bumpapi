const express = require('express');
const { 
  createLightningWallet, 
  importLightningWallet, 
  getLightningBalance, 
  createLightningInvoice, 
  payLightningInvoice,
  openLightningChannel,
  createLightningChannel,
  closeLightningChannel,
  getLightningTransactionHistory,
  getChannelConfigurations,
  updateChannelConfiguration,
  deleteChannelConfiguration
} = require('../controllers/lightningController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/create-wallet', createLightningWallet);
router.post('/create-channel', createLightningChannel);
router.get('/channel-configurations', getChannelConfigurations);
router.put('/channel-configurations/:id', updateChannelConfiguration);
router.delete('/channel-configurations/id', deleteChannelConfiguration);
router.post('/import-wallet', importLightningWallet);
router.get('/balance', getLightningBalance);
router.post('/create-invoice', createLightningInvoice);
router.post('/pay-invoice', payLightningInvoice);
router.post('/open-channel', openLightningChannel);
router.post('/close-channel', closeLightningChannel);
router.get('/transaction-history', getLightningTransactionHistory);

module.exports = router;