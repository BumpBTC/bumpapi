const User = require("../models/User");
const { lockFunds, unlockFunds } = require("../services/bitcoinService");

exports.stakeTokens = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.userId);
    await lockFunds(user.btcAddress, amount);
    user.stakedAmount = amount;
    user.stakingStartDate = new Date();
    await user.save();
    res.json({ message: "Tokens staked successfully", stakedAmount: amount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.unstakeTokens = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.stakedAmount) {
      throw new Error("No staked tokens found");
    }
    const currentDate = new Date();
    const stakingPeriod =
      (currentDate - user.stakingStartDate) / (1000 * 60 * 60 * 24); // in days
    if (stakingPeriod < 30) {
      throw new Error("Minimum staking period of 30 days not met");
    }
    const reward = calculateReward(user.stakedAmount, stakingPeriod);
    await unlockFunds(user.btcAddress, user.stakedAmount + reward);
    user.stakedAmount = 0;
    user.stakingStartDate = null;
    await user.save();
    res.json({
      message: "Tokens unstaked successfully",
      unstakedAmount: user.stakedAmount,
      reward,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

function calculateReward(amount, days) {
  // Simple reward calculation: 5% APY
  return amount * (0.05 / 365) * days;
}

module.exports = exports;