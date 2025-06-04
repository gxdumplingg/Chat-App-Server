const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const {
    calculateFileHash,
    processFileInChunks,
    verifyFileIntegrity,
    retryWithBackoff,
    cleanupTempFiles,
    validateFileMetadata
} = require('../utils/fileUtils');

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
    const validation = validateFileMetadata(file, {
        maxSize: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_FILE_TYPES
    });

    if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
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
            const command = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 "${thumbnailPath}"`;
            exec(command, (error) => {
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
    let tempFiles = [];
    try {
        // Kiểm tra file
        validateFile(req.file);

        let filePath = req.file.path;
        let thumbnailPath = null;
        let optimizedPath = null;
        let shouldDeleteOriginal = true;
        tempFiles.push(filePath);

        // Kiểm tra loại file trước khi xử lý
        const isImage = req.file.mimetype.startsWith('image/');
        const isVideo = req.file.mimetype.startsWith('video/');

        if (isImage) {
            try {
                const optimizationResult = await optimizeImage(filePath);
                filePath = optimizationResult.path;
                shouldDeleteOriginal = optimizationResult.shouldDelete;
                if (filePath !== req.file.path) {
                    tempFiles.push(filePath);
                }
            } catch (optimizeError) {
                console.error('Error optimizing image:', optimizeError);
            }
        } else if (isVideo) {
            // Không tối ưu hóa video, chỉ tạo thumbnail
            thumbnailPath = await generateVideoThumbnail(filePath);
            if (thumbnailPath) {
                tempFiles.push(thumbnailPath);
            }
            shouldDeleteOriginal = false; // Giữ lại file video gốc
        }

        // Calculate file hash before upload
        const originalHash = await calculateFileHash(filePath);

        // Upload lên Cloudinary với retry mechanism
        const result = await retryWithBackoff(async () => {
            const uploadOptions = {
                resource_type: 'auto',
                folder: 'chat-app',
                eager: [
                    { width: 300, height: 300, crop: 'pad', audio_codec: 'none' }
                ],
                eager_async: true
            };

            // Thêm cấu hình đặc biệt cho video
            if (req.file.mimetype.startsWith('video/')) {
                uploadOptions.resource_type = 'video';
                uploadOptions.eager = [
                    {
                        format: 'mp4',
                        video_codec: 'auto',
                        audio_codec: 'auto',
                        quality: 'auto'
                    }
                ];
                uploadOptions.eager_async = true;
            }

            return await cloudinary.uploader.upload(filePath, uploadOptions);
        });

        // Upload thumbnail nếu có
        let thumbnailUrl = null;
        if (thumbnailPath) {
            const thumbnailResult = await retryWithBackoff(async () => {
                return await cloudinary.uploader.upload(thumbnailPath, {
                    folder: 'chat-app/thumbnails'
                });
            });
            thumbnailUrl = thumbnailResult.secure_url;
        }

        // Cleanup files
        await cleanupTempFiles(tempFiles);

        res.json({
            url: result.secure_url,
            publicId: result.public_id,
            type: result.resource_type,
            thumbnailUrl,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes,
            hash: originalHash,
            duration: result.duration,
            videoUrl: req.file.mimetype.startsWith('video/') ? result.secure_url : null
        });
    } catch (error) {
        // Cleanup temp files in case of error
        await cleanupTempFiles(tempFiles);

        console.error('Upload error:', error);
        res.status(error.message.includes('quá lớn') ? 413 : 500)
            .json({
                message: error.message || 'Error uploading file',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
    }
};

// Upload multiple media
exports.uploadMultipleMedia = async (req, res) => {
    const tempFiles = [];
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const uploadPromises = req.files.map(async (file) => {
            const fileTempFiles = [];
            try {
                // Kiểm tra file
                validateFile(file);
                fileTempFiles.push(file.path);

                let filePath = file.path;
                let thumbnailPath = null;
                let optimizedPath = null;
                let shouldDeleteOriginal = true;

                // Kiểm tra loại file trước khi xử lý
                const isImage = file.mimetype.startsWith('image/');
                const isVideo = file.mimetype.startsWith('video/');

                if (isImage) {
                    try {
                        const optimizationResult = await optimizeImage(filePath);
                        filePath = optimizationResult.path;
                        shouldDeleteOriginal = optimizationResult.shouldDelete;
                        if (filePath !== file.path) {
                            fileTempFiles.push(filePath);
                        }
                    } catch (optimizeError) {
                        console.error('Error optimizing image:', optimizeError);
                    }
                } else if (isVideo) {
                    // Không tối ưu hóa video, chỉ tạo thumbnail
                    thumbnailPath = await generateVideoThumbnail(filePath);
                    if (thumbnailPath) {
                        fileTempFiles.push(thumbnailPath);
                    }
                    shouldDeleteOriginal = false; // Giữ lại file video gốc
                }

                // Calculate file hash before upload
                const originalHash = await calculateFileHash(filePath);

                // Upload lên Cloudinary với retry mechanism
                const result = await retryWithBackoff(async () => {
                    const uploadOptions = {
                        resource_type: 'auto',
                        folder: 'chat-app',
                        eager: [
                            { width: 300, height: 300, crop: 'pad', audio_codec: 'none' }
                        ],
                        eager_async: true
                    };

                    // Thêm cấu hình đặc biệt cho video
                    if (file.mimetype.startsWith('video/')) {
                        uploadOptions.resource_type = 'video';
                        uploadOptions.eager = [
                            {
                                format: 'mp4',
                                video_codec: 'auto',
                                audio_codec: 'auto',
                                quality: 'auto'
                            }
                        ];
                        uploadOptions.eager_async = true;
                    }

                    return await cloudinary.uploader.upload(filePath, uploadOptions);
                });

                // Upload thumbnail nếu có
                let thumbnailUrl = null;
                if (thumbnailPath) {
                    const thumbnailResult = await retryWithBackoff(async () => {
                        return await cloudinary.uploader.upload(thumbnailPath, {
                            folder: 'chat-app/thumbnails'
                        });
                    });
                    thumbnailUrl = thumbnailResult.secure_url;
                }

                // Cleanup files
                await cleanupTempFiles(fileTempFiles);

                return {
                    url: result.secure_url,
                    publicId: result.public_id,
                    type: result.resource_type,
                    thumbnailUrl,
                    width: result.width,
                    height: result.height,
                    format: result.format,
                    size: result.bytes,
                    hash: originalHash,
                    duration: result.duration,
                    videoUrl: file.mimetype.startsWith('video/') ? result.secure_url : null
                };
            } catch (error) {
                // Cleanup temp files in case of error
                await cleanupTempFiles(fileTempFiles);
                throw error;
            }
        });

        const results = await Promise.all(uploadPromises);
        res.json(results);
    } catch (error) {
        // Cleanup all temp files in case of error
        await cleanupTempFiles(tempFiles);

        console.error('Multiple upload error:', error);
        res.status(500).json({
            message: 'Error uploading files',
            error: error.message
        });
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