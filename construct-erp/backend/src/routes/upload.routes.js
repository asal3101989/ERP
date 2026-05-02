// src/routes/upload.routes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg','.jpeg','.png','.pdf','.xlsx','.docx','.dwg','.dxf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.post('/', upload.array('files', 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  const urls = req.files.map(f => `/uploads/${f.filename}`);
  res.json({ urls, count: urls.length, message: `${urls.length} file(s) uploaded` });
});

router.post('/single', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

module.exports = router;
