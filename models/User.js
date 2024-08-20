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
});

const transactionSchema = new mongoose.Schema({
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
  email: { type: String, required: true, unique: true },
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
  phoneNumber: { type: String },
  totpSecret: { type: String },
  hardwareKeyId: { type: String },
  walletTypes: {
    bitcoin: { type: Boolean, default: false },
    lightning: { type: Boolean, default: false },
    litecoin: { type: Boolean, default: false },
  },
  wallets: [walletSchema],
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
