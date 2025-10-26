import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('padImage'), (req, res) => {
  const filePath = path.resolve(req.file.path);
  console.log('Received image:', filePath);
  res.json({ success: true, path: filePath });
});

app.listen(5000, () => console.log('Server running on port 5000'));