const registerLoad = async (req, res) => {
    try {
        res.status(200).json({ message: "Register endpoint is working" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const register = async (req, res) => {
    try {
        // Lấy dữ liệu từ request body
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin" });
        }

        res.status(201).json({ message: "Đăng ký thành công" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { registerLoad, register };
