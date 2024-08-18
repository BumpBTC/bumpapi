const express = require('express');
const { stakeTokens, unstakeTokens } = require('../controllers/stakeController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authMiddleware);

router.post('/stake', stakeTokens);
router.post('/unstake', unstakeTokens);

module.exports = router;