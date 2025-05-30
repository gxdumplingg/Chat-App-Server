const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { uploadSingle, uploadMultiple } = require('../config/cloudinary');
const auth = require('../middlewares/auth');


// Upload single media
router.post('/upload', auth, uploadSingle, mediaController.uploadMedia);

// Upload multiple media
router.post('/upload-multiple', auth, uploadMultiple, mediaController.uploadMultipleMedia);

// Delete media
router.delete('/:publicId', auth, mediaController.deleteMedia);

// Get media info
router.get('/info/:publicId', auth, mediaController.getMediaInfo);

module.exports = router; 