/**
 * @swagger
 * components:
 *   schemas:
 *     Conversation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID của cuộc trò chuyện
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               username:
 *                 type: string
 *               avatar:
 *                 type: string
 *               status:
 *                 type: string
 *               lastSeen:
 *                 type: string
 *                 format: date-time
 *         type:
 *           type: string
 *           enum: [private, group]
 *           description: Loại cuộc trò chuyện
 *         name:
 *           type: string
 *           description: Tên cuộc trò chuyện (cho nhóm)
 *         avatar:
 *           type: string
 *           description: Ảnh đại diện cuộc trò chuyện
 *         lastMessage:
 *           type: object
 *           description: Tin nhắn cuối cùng
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     CreateConversationRequest:
 *       type: object
 *       required:
 *         - participants
 *       properties:
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách ID người tham gia
 *         type:
 *           type: string
 *           enum: [private, group]
 *           default: group
 *           description: Loại cuộc trò chuyện
 * 
 *     UpdateConversationRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Tên mới của cuộc trò chuyện
 *         avatar:
 *           type: string
 *           description: URL ảnh đại diện mới
 * 
 *     AddParticipantRequest:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: string
 *           description: ID của người dùng cần thêm
 * 
 *     LeaveConversationRequest:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: string
 *           description: ID của người dùng rời nhóm
 */

/**
 * @swagger
 * /conversations:
 *   get:
 *     tags:
 *       - Conversations
 *     summary: Lấy danh sách cuộc trò chuyện
 *     description: Lấy tất cả cuộc trò chuyện của người dùng hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách cuộc trò chuyện
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 *   post:
 *     tags:
 *       - Conversations
 *     summary: Tạo cuộc trò chuyện mới
 *     description: Tạo một cuộc trò chuyện mới (private hoặc group)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateConversationRequest'
 *     responses:
 *       201:
 *         description: Cuộc trò chuyện được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /conversations/{id}:
 *   put:
 *     tags:
 *       - Conversations
 *     summary: Cập nhật thông tin cuộc trò chuyện
 *     description: Cập nhật tên hoặc ảnh đại diện của cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateConversationRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 *   delete:
 *     tags:
 *       - Conversations
 *     summary: Xóa cuộc trò chuyện
 *     description: Xóa một cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /conversations/{id}/participants:
 *   post:
 *     tags:
 *       - Conversations
 *     summary: Thêm thành viên vào cuộc trò chuyện
 *     description: Thêm một người dùng vào cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddParticipantRequest'
 *     responses:
 *       200:
 *         description: Thêm thành viên thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /conversations/{id}/participants/{userId}:
 *   delete:
 *     tags:
 *       - Conversations
 *     summary: Xóa thành viên khỏi cuộc trò chuyện
 *     description: Xóa một người dùng khỏi cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành viên thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện hoặc người dùng
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /conversations/{id}/leave:
 *   post:
 *     tags:
 *       - Conversations
 *     summary: Rời khỏi cuộc trò chuyện
 *     description: Rời khỏi một cuộc trò chuyện
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeaveConversationRequest'
 *     responses:
 *       200:
 *         description: Rời nhóm thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 * 
 * /conversations/{id}/read:
 *   put:
 *     tags:
 *       - Conversations
 *     summary: Đánh dấu đã đọc
 *     description: Đánh dấu tất cả tin nhắn trong cuộc trò chuyện là đã đọc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc trò chuyện
 *     responses:
 *       200:
 *         description: Đánh dấu đã đọc thành công
 *       404:
 *         description: Không tìm thấy cuộc trò chuyện
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */ 