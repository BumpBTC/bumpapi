const express = require('express');
const multer = require('multer');
const path = require('path');
const { getContacts, addContact, updateContact, deleteContact } = require('../controllers/contactController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 } // 1 MB limit
});

router.use(authMiddleware);

router.get('/', getContacts);
router.post('/', upload.single('picture'), addContact);
router.put('/:contactId', upload.single('picture'), updateContact);
router.delete('/:contactId', deleteContact);

module.exports = router;