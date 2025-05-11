const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;


const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        url: {
            type: String,
            default: 'https://res.cloudinary.com/chatapp-cloud/image/upload/v1/default-avatar.png'
        },
        publicId: {
            type: String,
            default: null
        }
    },
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

// Hash password trước khi lưu
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method để so sánh password
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
