const User = require('../models/User');
const { isValidBitcoinAddress, isValidLightningAddress, isValidLitecoinAddress } = require('../utils/addressValidation');
const fs = require('fs');
const path = require('path');

exports.getContacts = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json(user.contacts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

exports.addContact = async (req, res) => {
  try {
    const { name, bitcoinAddress, lightningPublicKey, litecoinAddress } = req.body;
    let picture = null;

    if (req.file) {
      const maxSize = 1 * 1024 * 1024; // 1 MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'Image size should be less than 1 MB' });
      }
      picture = req.file.filename;
    }

    if (bitcoinAddress && !isValidBitcoinAddress(bitcoinAddress)) {
      return res.status(400).json({ error: 'Invalid Bitcoin address' });
    }
    if (lightningPublicKey && !isValidLightningAddress(lightningPublicKey)) {
      return res.status(400).json({ error: 'Invalid Lightning public key' });
    }
    if (litecoinAddress && !isValidLitecoinAddress(litecoinAddress)) {
      return res.status(400).json({ error: 'Invalid Litecoin address' });
    }

    const user = await User.findById(req.userId);
    user.contacts.push({ name, picture, bitcoinAddress, lightningPublicKey, litecoinAddress });
    await user.save();
    res.json(user.contacts[user.contacts.length - 1]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add contact' });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { name, bitcoinAddress, lightningPublicKey, litecoinAddress } = req.body;
    let picture = null;

    const user = await User.findById(req.userId);
    const contact = user.contacts.id(contactId);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (req.file) {
      const maxSize = 1 * 1024 * 1024; // 1 MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'Image size should be less than 1 MB' });
      }
      
      if (contact.picture) {
        const oldPicturePath = path.join(__dirname, '..', 'uploads', contact.picture);
        fs.unlinkSync(oldPicturePath);
      }
      
      picture = req.file.filename;
    }

    if (bitcoinAddress && !isValidBitcoinAddress(bitcoinAddress)) {
      return res.status(400).json({ error: 'Invalid Bitcoin address' });
    }
    if (lightningPublicKey && !isValidLightningAddress(lightningPublicKey)) {
      return res.status(400).json({ error: 'Invalid Lightning public key' });
    }
    if (litecoinAddress && !isValidLitecoinAddress(litecoinAddress)) {
      return res.status(400).json({ error: 'Invalid Litecoin address' });
    }

    contact.set({ name, picture: picture || contact.picture, bitcoinAddress, lightningPublicKey, litecoinAddress });
    await user.save();
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const user = await User.findById(req.userId);
    user.contacts.id(contactId).remove();
    await user.save();
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
};