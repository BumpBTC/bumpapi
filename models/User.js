const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const channelConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nodeUri: { type: String, required: true },
  amount: { type: Number, required: true },
  isFavorite: { type: Boolean, default: false }
});

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  picture: { type: String, default: 'default-avatar' },
  bitcoinAddress: { type: String },
  lightningPublicKey: { type: String },
  litecoinAddress: { type: String },
});

const walletSchema = new mongoose.Schema({
  wallets: [{
    type: {
      type: String,
      enum: ["bitcoin", "lightning", "litecoin"],
      required: true,
    },
    address: { type: String },
    publicKey: { type: String },
    privateKey: { type: String },
    mnemonic: { type: String },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
  }],
});

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ["send", "receive"], required: true },
  amount: { type: Number, required: true },
  address: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  walletType: {
    type: String,
    enum: ["bitcoin", "lightning", "litecoin"],
    required: true,
  },
  txid: { type: String },
  paymentHash: { type: String },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  contacts: [contactSchema],
  securityLevel: { type: Number, default: 1 },
  channelConfigurations: [channelConfigSchema],
  // securityLevel: {
  //   type: String,
  //   enum: ["basic", "email", "phone", "multi", "authenticator", "hardware"],
  //   default: "basic",
  // },
  preferredCurrency: { type: String, default: 'USD' },
  backedUp: { type: Boolean, default: false },
  phoneNumber: { type: String },
  totpSecret: { type: String },
  hardwareKeyId: { type: String },
  bitcoinWallet: {
    address: String,
    privateKey: String,
  },
  litecoinWallet: {
    address: String,
    privateKey: String,
  },
  lightningChannel: {
    nodeId: String,
    channelPoint: String,
  },
  walletTypes: {
    bitcoin: { type: Boolean, default: false },
    lightning: { type: Boolean, default: false },
    litecoin: { type: Boolean, default: false },
  },
  wallets: [walletSchema],
  activeWallets: {
    bitcoin: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    lightning: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    litecoin: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  },
  transactions: [transactionSchema],
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
module.exports = mongoose.model('Transaction', transactionSchema);
