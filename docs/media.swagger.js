/**
 * @swagger
 * components:
 *   schemas:
 *     MediaResponse:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           description: URL của media đã upload
 *         publicId:
 *           type: string
 *           description: Public ID của media trên Cloudinary
 *         type:
 *           type: string
 *           description: Loại media (image, video, raw)
 * 
 *     MediaInfo:
 *       type: object
 *       properties:
 *         public_id:
 *           type: string
 *           description: Public ID của media
 *         format:
 *           type: string
 *           description: Định dạng file
 *         resource_type:
 *           type: string
 *           description: Loại resource (image, video, raw)
 *         bytes:
 *           type: integer
 *           description: Kích thước file (bytes)
 *         width:
 *           type: integer
 *           description: Chiều rộng (cho ảnh)
 *         height:
 *           type: integer
 *           description: Chiều cao (cho ảnh)
 *         url:
 *           type: string
 *           description: URL của media
 *         secure_url:
 *           type: string
 *           description: HTTPS URL của media
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian tạo
 */

/**
 * @swagger
 * /media/upload:
 *   post:
 *     tags:
 *       - Media
 *     summary: Upload một file media
 *     description: Upload một file media (ảnh, video, file) lên Cloudinary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: File media cần upload
 *     responses:
 *       200:
 *         description: Upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaResponse'
 *       400:
 *         description: Không có file được upload
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /media/upload-multiple:
 *   post:
 *     tags:
 *       - Media
 *     summary: Upload nhiều file media
 *     description: Upload nhiều file media (tối đa 10 file) lên Cloudinary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Danh sách file media cần upload (tối đa 10 file)
 *     responses:
 *       200:
 *         description: Upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MediaResponse'
 *       400:
 *         description: Không có file được upload
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /media/{publicId}:
 *   delete:
 *     tags:
 *       - Media
 *     summary: Xóa media
 *     description: Xóa một file media từ Cloudinary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID của media cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Media deleted successfully
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /media/info/{publicId}:
 *   get:
 *     tags:
 *       - Media
 *     summary: Lấy thông tin media
 *     description: Lấy thông tin chi tiết của một file media từ Cloudinary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID của media cần lấy thông tin
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaInfo'
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */ 