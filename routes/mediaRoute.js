const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { upload } = require('../config/cloudinary');
const auth = require('../middlewares/auth');


// Upload single media
router.post('/upload', auth, upload.single('media'), mediaController.uploadMedia);

// Upload multiple media
router.post('/upload-multiple', auth, upload.array('media', 10), mediaController.uploadMultipleMedia);

// Delete media
router.delete('/:publicId', auth, mediaController.deleteMedia);

// Get media info
router.get('/info/:publicId', auth, mediaController.getMediaInfo);

module.exports = router; 