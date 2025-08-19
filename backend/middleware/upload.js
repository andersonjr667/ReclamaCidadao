const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens até 5MB são permitidas!'), false);
  }
};

module.exports = multer({ storage, fileFilter });
