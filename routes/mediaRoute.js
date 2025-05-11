const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { cloudinary, upload } = require('../config/cloudinary');
const mediaController = require('../controllers/mediaController');
const auth = require('../middlewares/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../temp'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadMiddleware = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images and videos
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and videos are allowed.'));
        }
    }
});

// Upload media
router.post('/upload', auth, uploadMiddleware.single('media'), mediaController.uploadMedia);

// Delete media
router.delete('/:publicId', auth, mediaController.deleteMedia);

// Get media info
router.get('/info/:publicId', auth, mediaController.getMediaInfo);

module.exports = router; 