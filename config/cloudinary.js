const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Tạo thư mục temp nếu chưa tồn tại
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    // Kiểm tra định dạng file
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Định dạng file không được hỗ trợ'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10 // Tối đa 10 files cho upload nhiều
    }
});

// Tạo các middleware riêng cho từng loại upload
const uploadSingle = upload.single('media');
const uploadMultiple = upload.array('media', 10);

// Wrap middleware để xử lý lỗi
const handleUpload = (uploadMiddleware) => {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({
                        message: `File quá lớn. Kích thước tối đa là ${10}MB`
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(413).json({
                        message: 'Quá nhiều file. Tối đa 10 file'
                    });
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({
                        message: 'Tên field không đúng. Sử dụng "media" cho file upload'
                    });
                }
                return res.status(400).json({
                    message: err.message
                });
            } else if (err) {
                return res.status(400).json({
                    message: err.message
                });
            }
            next();
        });
    };
};

module.exports = {
    cloudinary,
    upload,
    uploadSingle: handleUpload(uploadSingle),
    uploadMultiple: handleUpload(uploadMultiple)
}; 