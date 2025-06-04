/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID của tin nhắn
 *         conversationId:
 *           type: string
 *           description: ID của cuộc trò chuyện
 *         senderId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             username:
 *               type: string
 *             avatar:
 *               type: string
 *         text:
 *           type: string
 *           description: Nội dung tin nhắn
 *         messageType:
 *           type: string
 *           enum: [text, image, video, audio, file, emoji]
 *           default: text
 *           description: Loại tin nhắn
 *         attachments:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách file đính kèm
 *         status:
 *           type: object
 *           description: Trạng thái đọc của tin nhắn theo từng người dùng
 *         reactions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               emoji:
 *                 type: string
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *         emojiData:
 *           type: object
 *           properties:
 *             emoji:
 *               type: string
 *             skinTone:
 *               type: string
 *             isCustomEmoji:
 *               type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     SendMessageRequest:
 *       type: object
 *       required:
 *         - conversationId
 *         - messageType
 *       oneOf:
 *         - required:
 *             - text
 *           properties:
 *             messageType:
 *               enum: [text]
 *         - required:
 *             - attachments
 *           properties:
 *             messageType:
 *               enum: [image, video, audio, file]
 *         - required:
 *             - emojiData
 *           properties:
 *             messageType:
 *               enum: [emoji]
 *       properties:
 *         conversationId:
 *           type: string
 *           description: ID của cuộc trò chuyện
 *         text:
 *           type: string
 *           description: Nội dung tin nhắn (bắt buộc cho messageType text)
 *         messageType:
 *           type: string
 *           enum: [text, image, video, audio, file, emoji]
 *           default: text
 *           description: Loại tin nhắn
 *         attachments:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách file đính kèm (bắt buộc cho messageType image, video, audio, file)
 *         emojiData:
 *           type: object
 *           description: Dữ liệu emoji (bắt buộc cho messageType emoji)
 *           required:
 *             - emoji
 *           properties:
 *             emoji:
 *               type: string
 *               description: Emoji được chọn
 *             skinTone:
 *               type: string
 *               description: Màu da của emoji (nếu có)
 *             isCustomEmoji:
 *               type: boolean
 *               description: Có phải emoji tùy chỉnh không
 * 
 *     ReactToMessageRequest:
 *       type: object
 *       required:
 *         - emoji
 *       properties:
 *         emoji:
 *           type: string
 *           description: Emoji reaction
 * 
 *     MarkMessageAsReadRequest:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: string
 *           description: ID của người dùng đánh dấu đã đọc
 */

/**
 * @swagger
 * /message:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Gửi tin nhắn mới
 *     description: Gửi một tin nhắn mới vào cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         description: Tin nhắn được gửi thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /message/{conversationId}:
 *   get:
 *     tags:
 *       - Messages
 *     summary: Lấy danh sách tin nhắn
 *     description: Lấy tất cả tin nhắn của một cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *     responses:
 *       200:
 *         description: Danh sách tin nhắn
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       403:
 *         description: Không có quyền truy cập cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /message/{messageId}:
 *   delete:
 *     tags:
 *       - Messages
 *     summary: Xóa tin nhắn
 *     description: Xóa một tin nhắn (chỉ người gửi mới có quyền xóa)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tin nhắn
 *     responses:
 *       200:
 *         description: Xóa tin nhắn thành công
 *       404:
 *         description: Không tìm thấy tin nhắn
 *       403:
 *         description: Không có quyền xóa tin nhắn
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /message/{messageId}/react:
 *   put:
 *     tags:
 *       - Messages
 *     summary: Thêm hoặc cập nhật reaction cho tin nhắn
 *     description: Thêm hoặc cập nhật emoji reaction cho tin nhắn
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tin nhắn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReactToMessageRequest'
 *     responses:
 *       200:
 *         description: Thêm/cập nhật reaction thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       404:
 *         description: Không tìm thấy tin nhắn
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /message/{id}/read:
 *   put:
 *     tags:
 *       - Messages
 *     summary: Đánh dấu tin nhắn đã đọc
 *     description: Đánh dấu một tin nhắn là đã đọc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tin nhắn
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarkMessageAsReadRequest'
 *     responses:
 *       200:
 *         description: Đánh dấu đã đọc thành công
 *       404:
 *         description: Không tìm thấy tin nhắn
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */ 