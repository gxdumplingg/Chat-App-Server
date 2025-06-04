const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

// Constants
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for processing large files
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Calculate file hash using SHA-256
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - File hash
 */
const calculateFileHash = async (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

/**
 * Process file in chunks to handle large files
 * @param {string} filePath - Path to the file
 * @param {Function} processChunk - Function to process each chunk
 * @returns {Promise<void>}
 */
const processFileInChunks = async (filePath, processChunk) => {
    const fileHandle = await fsPromises.open(filePath, 'r');
    const fileStats = await fileHandle.stat();
    const totalChunks = Math.ceil(fileStats.size / CHUNK_SIZE);

    try {
        for (let i = 0; i < totalChunks; i++) {
            const buffer = Buffer.alloc(CHUNK_SIZE);
            const { bytesRead } = await fileHandle.read(buffer, 0, CHUNK_SIZE, i * CHUNK_SIZE);
            await processChunk(buffer.slice(0, bytesRead), i, totalChunks);
        }
    } finally {
        await fileHandle.close();
    }
};

/**
 * Verify file integrity after upload
 * @param {string} originalPath - Path to original file
 * @param {string} uploadedPath - Path to uploaded file
 * @returns {Promise<boolean>} - Whether files match
 */
const verifyFileIntegrity = async (originalPath, uploadedPath) => {
    const originalHash = await calculateFileHash(originalPath);
    const uploadedHash = await calculateFileHash(uploadedPath);
    return originalHash === uploadedHash;
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise<any>} - Function result
 */
const retryWithBackoff = async (fn, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) => {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }

    throw lastError;
};

/**
 * Clean up temporary files
 * @param {string[]} filePaths - Array of file paths to clean up
 * @returns {Promise<void>}
 */
const cleanupTempFiles = async (filePaths) => {
    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                await fsPromises.unlink(filePath);
            } catch (error) {
                console.error(`Error cleaning up file ${filePath}:`, error);
            }
        })
    );
};

/**
 * Validate file metadata
 * @param {Object} file - File object
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
const validateFileMetadata = (file, options = {}) => {
    const {
        maxSize = 10 * 1024 * 1024, // 10MB
        allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo'
        ]
    } = options;

    const errors = [];

    if (!file) {
        errors.push('No file provided');
        return { isValid: false, errors };
    }

    if (file.size > maxSize) {
        errors.push(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
        errors.push('File type not allowed');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = {
    calculateFileHash,
    processFileInChunks,
    verifyFileIntegrity,
    retryWithBackoff,
    cleanupTempFiles,
    validateFileMetadata
}; 