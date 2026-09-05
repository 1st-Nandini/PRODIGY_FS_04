import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  text: { type: String, trim: true, maxlength: 2000 },
  type: { type: String, enum: ['text', 'file'], default: 'text' },
  file: {
    name: String,
    mimeType: String,
    dataUrl: String
  }
}, { timestamps: true });

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
