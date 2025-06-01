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

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Kiểm tra tính hợp lệ của file
const validateFile = (file) => {
    if (!file) {
        throw new Error('Không có file được upload');
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File quá lớn. Kích thước tối đa là ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        throw new Error('Định dạng file không được hỗ trợ');
    }

    return true;
};

// Tạo thumbnail cho video
const generateVideoThumbnail = async (videoPath) => {
    try {
        const thumbnailPath = path.join(path.dirname(videoPath), 'thumbnail-' + path.basename(videoPath, path.extname(videoPath)) + '.jpg');

        // Sử dụng ffmpeg để tạo thumbnail (cần cài đặt ffmpeg)
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`, (error) => {
                if (error) {
                    console.error('Error generating thumbnail:', error);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        return thumbnailPath;
    } catch (error) {
        console.error('Error in generateVideoThumbnail:', error);
        return null;
    }
};

// Tối ưu hóa ảnh
const optimizeImage = async (inputPath) => {
    try {
        console.log('Starting image optimization for:', inputPath);

        // Kiểm tra xem file có tồn tại không
        await fs.access(inputPath);
        console.log('File exists and is accessible');

        const outputPath = path.join(path.dirname(inputPath), 'optimized-' + path.basename(inputPath));
        console.log('Output path will be:', outputPath);

        // Đọc metadata của ảnh
        const metadata = await sharp(inputPath).metadata();
        console.log('Image metadata:', metadata);

        // Nếu ảnh đã nhỏ hơn 1MB, không cần tối ưu
        if (metadata.size && metadata.size < 1024 * 1024) {
            console.log('Image is already small enough, skipping optimization');
            return { path: inputPath, shouldDelete: false };
        }

        console.log('Starting image optimization...');
        // Tối ưu ảnh
        await sharp(inputPath)
            .resize(1000, 1000, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(outputPath);
        console.log('Image optimization completed');

        // Đợi một chút để đảm bảo file đã được ghi xong
        await new Promise(resolve => setTimeout(resolve, 1000));

        return { path: outputPath, shouldDelete: true };
    } catch (error) {
        console.error('Error optimizing image:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            path: inputPath
        });
        // Nếu có lỗi, trả về file gốc
        return { path: inputPath, shouldDelete: false };
    }
};

// Upload single media
exports.uploadMedia = async (req, res) => {
    try {
        // Kiểm tra file
        validateFile(req.file);

        let filePath = req.file.path;
        let thumbnailPath = null;
        let optimizedPath = null;
        let shouldDeleteOriginal = true;

        // Xử lý file dựa trên loại
        if (req.file.mimetype.startsWith('image/')) {
            try {
                const optimizationResult = await optimizeImage(filePath);
                filePath = optimizationResult.path;
                shouldDeleteOriginal = optimizationResult.shouldDelete;
            } catch (optimizeError) {
                console.error('Error optimizing image:', optimizeError);
                // Tiếp tục với file gốc nếu có lỗi
            }
        } else if (req.file.mimetype.startsWith('video/')) {
            thumbnailPath = await generateVideoThumbnail(filePath);
        }

        // Upload lên Cloudinary
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'auto',
            folder: 'chat-app',
            eager: [
                { width: 300, height: 300, crop: 'pad', audio_codec: 'none' },
                { width: 600, height: 600, crop: 'lfill', audio_codec: 'none' }
            ],
            eager_async: true
        });

        // Upload thumbnail nếu có
        let thumbnailUrl = null;
        if (thumbnailPath) {
            const thumbnailResult = await cloudinary.uploader.upload(thumbnailPath, {
                folder: 'chat-app/thumbnails'
            });
            thumbnailUrl = thumbnailResult.secure_url;
        }

        // Cleanup files
        const filesToDelete = [
            shouldDeleteOriginal ? req.file.path : null, // File gốc (chỉ xóa nếu cần)
            filePath !== req.file.path ? filePath : null, // File đã optimize (nếu khác file gốc)
            thumbnailPath  // Thumbnail (nếu có)
        ].filter(Boolean); // Lọc bỏ các giá trị null/undefined

        await Promise.all(
            filesToDelete.map(file =>
                fs.unlink(file).catch(err =>
                    console.error(`Error deleting file ${file}:`, err)
                )
            )
        );

        res.json({
            url: result.secure_url,
            publicId: result.public_id,
            type: result.resource_type,
            thumbnailUrl,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(error.message.includes('quá lớn') ? 413 : 500)
            .json({ message: error.message || 'Error uploading file' });
    }
};

// Upload multiple media
exports.uploadMultipleMedia = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const uploadPromises = req.files.map(async (file) => {
            try {
                // Kiểm tra file
                validateFile(file);

                let filePath = file.path;
                let thumbnailPath = null;
                let optimizedPath = null;
                let shouldDeleteOriginal = true;

                // Xử lý file dựa trên loại
                if (file.mimetype.startsWith('image/')) {
                    try {
                        const optimizationResult = await optimizeImage(filePath);
                        filePath = optimizationResult.path;
                        shouldDeleteOriginal = optimizationResult.shouldDelete;
                    } catch (optimizeError) {
                        console.error('Error optimizing image:', optimizeError);
                        // Tiếp tục với file gốc nếu có lỗi
                    }
                } else if (file.mimetype.startsWith('video/')) {
                    thumbnailPath = await generateVideoThumbnail(filePath);
                }

                // Upload lên Cloudinary
                const result = await cloudinary.uploader.upload(filePath, {
                    resource_type: 'auto',
                    folder: 'chat-app',
                    eager: [
                        { width: 300, height: 300, crop: 'pad', audio_codec: 'none' },
                        { width: 600, height: 600, crop: 'lfill', audio_codec: 'none' }
                    ],
                    eager_async: true
                });

                // Upload thumbnail nếu có
                let thumbnailUrl = null;
                if (thumbnailPath) {
                    const thumbnailResult = await cloudinary.uploader.upload(thumbnailPath, {
                        folder: 'chat-app/thumbnails'
                    });
                    thumbnailUrl = thumbnailResult.secure_url;
                }

                // Cleanup files
                const filesToDelete = [
                    shouldDeleteOriginal ? file.path : null, // File gốc (chỉ xóa nếu cần)
                    filePath !== file.path ? filePath : null, // File đã optimize (nếu khác file gốc)
                    thumbnailPath  // Thumbnail (nếu có)
                ].filter(Boolean); // Lọc bỏ các giá trị null/undefined

                await Promise.all(
                    filesToDelete.map(file =>
                        fs.unlink(file).catch(err =>
                            console.error(`Error deleting file ${file}:`, err)
                        )
                    )
                );

                return {
                    url: result.secure_url,
                    publicId: result.public_id,
                    type: result.resource_type,
                    thumbnailUrl,
                    width: result.width,
                    height: result.height,
                    format: result.format,
                    size: result.bytes
                };
            } catch (error) {
                console.error('Error uploading file:', error);
                return {
                    error: true,
                    message: `Error uploading ${file.originalname}: ${error.message}`
                };
            }
        });

        const results = await Promise.all(uploadPromises);
        res.json(results);
    } catch (error) {
        console.error('Multiple upload error:', error);
        res.status(500).json({ message: 'Error uploading files' });
    }
};

// Delete media
exports.deleteMedia = async (req, res) => {
    try {
        const { publicId } = req.params;

        // Kiểm tra xem media có tồn tại không
        const mediaInfo = await cloudinary.api.resource(publicId);
        if (!mediaInfo) {
            return res.status(404).json({ message: 'Media not found' });
        }

        // Xóa media và các biến thể
        await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
            resource_type: 'auto'
        });

        res.json({ message: 'Media deleted successfully' });
    } catch (error) {
        console.error('Delete media error:', error);
        res.status(500).json({ message: 'Error deleting media' });
    }
};

// Get media info
exports.getMediaInfo = async (req, res) => {
    try {
        const { publicId } = req.params;
        const result = await cloudinary.api.resource(publicId, {
            resource_type: 'auto'
        });

        // Thêm thông tin về các biến thể
        const variants = result.derived || [];
        const transformedUrls = variants.map(variant => ({
            url: variant.secure_url,
            width: variant.width,
            height: variant.height
        }));

        res.json({
            ...result,
            transformedUrls
        });
    } catch (error) {
        console.error('Get media info error:', error);
        res.status(500).json({ message: 'Error getting media info' });
    }
}; 