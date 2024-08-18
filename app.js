const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const lightningRoutes = require("./routes/lightningRoutes");
const litecoinRoutes = require("./routes/litecoinRoutes");
const stakeRoutes = require("./routes/stakeRoutes");
const { errorHandler } = require("./middleware/errorMiddleware");
const { initLightning } = require("./services/lightningService");
const { authMiddleware } = require("./middleware/authMiddleware");

require("dotenv").config();

const app = express();

// app.use(cors());
app.use(
  cors({
    origin: ["http://localhost:8081", "http://192.168.1.199:8081"],
  })
);
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/wallet", authMiddleware, walletRoutes);
app.use("/api/wallet", walletRoutes);
app.use('/api/lightning', authMiddleware, lightningRoutes);
app.use("/api/litecoin", authMiddleware, litecoinRoutes);
app.use("/api/stake", stakeRoutes);
app.get("/convert", async (req, res) => {
  try {
    const { amount, from, to } = req.query;
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,litecoin&vs_currencies=usd`
    );
    const btcPrice = response.data.bitcoin.usd;
    const ltcPrice = response.data.litecoin.usd;

    let convertedAmount;
    if (from.toUpperCase() === "BTC" && to.toUpperCase() === "USD") {
      convertedAmount = amount * btcPrice;
    } else if (from.toUpperCase() === "USD" && to.toUpperCase() === "BTC") {
      convertedAmount = amount / btcPrice;
    } else if (from.toUpperCase() === "LTC" && to.toUpperCase() === "USD") {
      convertedAmount = amount * ltcPrice;
    } else if (from.toUpperCase() === "USD" && to.toUpperCase() === "LTC") {
      convertedAmount = amount / ltcPrice;
    } else {
      throw new Error("Invalid conversion parameters");
    }

    res.json({ amount: convertedAmount.toFixed(8) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.use(errorHandler);

initLightning().catch(console.error);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
