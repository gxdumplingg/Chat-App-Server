const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Tối ưu hóa ảnh trước khi upload
const optimizeImage = async (inputPath) => {
    try {
        const outputPath = path.join(path.dirname(inputPath), 'optimized-' + path.basename(inputPath));

        // Đọc metadata của ảnh
        const metadata = await sharp(inputPath).metadata();

        // Nếu ảnh đã nhỏ hơn 1MB, không cần tối ưu
        if (metadata.size && metadata.size < 1024 * 1024) {
            return inputPath;
        }

        // Tối ưu ảnh
        await sharp(inputPath)
            .resize(1000, 1000, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(outputPath);

        // Đợi một chút để đảm bảo file đã được ghi xong
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            // Xóa file gốc
            await fs.unlink(inputPath);
        } catch (unlinkError) {
            console.error('Error deleting original file:', unlinkError);
            // Tiếp tục với file đã tối ưu
        }

        return outputPath;
    } catch (error) {
        console.error('Error optimizing image:', error);
        return inputPath; // Trả về file gốc nếu có lỗi
    }
};

// Upload media
exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Tối ưu ảnh nếu là file ảnh
        let filePath = req.file.path;
        if (req.file.mimetype.startsWith('image/')) {
            filePath = await optimizeImage(req.file.path);
        }

        // Upload lên Cloudinary
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'auto',
            folder: 'chat-app'
        });

        // Đợi một chút trước khi xóa file
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            // Xóa file tạm
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('Error deleting temp file:', unlinkError);
            // Tiếp tục với response
        }

        res.json({
            url: result.secure_url,
            publicId: result.public_id,
            type: result.resource_type
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
};

// Delete media
exports.deleteMedia = async (req, res) => {
    try {
        const { publicId } = req.params;
        await cloudinary.uploader.destroy(publicId);
        res.json({ message: 'Media deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting media' });
    }
};

// Get media info
exports.getMediaInfo = async (req, res) => {
    try {
        const { publicId } = req.params;
        const result = await cloudinary.api.resource(publicId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error getting media info' });
    }
}; 