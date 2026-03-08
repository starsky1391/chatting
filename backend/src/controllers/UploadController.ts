// 上传控制器
// 处理图片上传请求，将图片存储到本地目录
// 支持单张图片上传
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ResponseUtil from '../utils/response';

// 配置multer存储
// 定义图片存储路径和文件名生成规则
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 确保上传目录存在
    const uploadDir = path.join(__dirname, '../../uploads/images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：时间戳 + 随机字符串 + 原始文件扩展名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}_${randomString}${ext}`;
    cb(null, filename);
  }
});

// 创建multer实例
// 配置只允许上传图片文件
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制文件大小为5MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许上传图片文件
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

export class UploadController {
  /**
   * 处理图片上传
   * @param req Request对象，包含上传的文件
   * @param res Response对象，用于返回上传结果
   */
  uploadImage(req: Request, res: Response) {
    // 使用multer中间件处理单文件上传
    upload.single('image')(req, res, (err) => {
      if (err) {
        // 处理上传错误
        return ResponseUtil.badRequest(res, err.message);
      }

      // 检查是否有文件上传
      if (!req.file) {
        return ResponseUtil.badRequest(res, '请选择要上传的图片');
      }

      // 构建图片URL路径
      // 返回的路径格式：image:/uploads/images/filename.jpg
      const imagePath = `/uploads/images/${req.file.filename}`;
      const imageUrl = `image:${imagePath}`;

      // 返回成功响应，包含图片路径
      return ResponseUtil.success(res, { url: imageUrl, path: imagePath }, '图片上传成功');
    });
  }
}