const express = require("express");
const {
  getWalletInfo,
  importWallet,
  getAccountDetails,
  removeAccount,
  resetPassword,
  sendBitcoin,
  sendLitecoin,
  sendLightning,
  createLightningInvoice,
  updateSecurityLevel,
  backupWallet,
  restoreWallet,
  sendTransaction,
  getTransactionHistory,
  updateAccountSettings,
} = require("../controllers/walletController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/info", getWalletInfo);
router.delete("/remove-account", removeAccount);
router.post("/reset-password", resetPassword);
router.post("/import", importWallet);
router.post("/send-bitcoin", sendBitcoin);
router.post("/send-lightning", sendLightning);
router.post("/send-transaction", sendTransaction);
router.get("/account-details", getAccountDetails);
router.post("/create-lightning-invoice", createLightningInvoice);
router.post("/update-security", authMiddleware, updateSecurityLevel);
router.get("/backup", backupWallet);
router.post("/restore", restoreWallet);
router.get("/transaction-history", getTransactionHistory);
router.post("/update-settings", updateAccountSettings);

module.exports = router;
