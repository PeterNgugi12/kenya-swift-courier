const express = require('express');
const companyController = require('../controllers/company.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const upload = require('../middlewares/upload.middleware');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All company routes require authentication and SUPER_ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.SUPER_ADMIN));

// Handle both FormData and JSON
router.post(
  '/', 
  upload.single('logo'), // 'logo' should match the field name in your form
  (req, res, next) => {
    // If it's JSON, req.body will be populated
    // If it's FormData, req.body will have text fields and req.file will have the file
    console.log('File:', req.file);
    console.log('Body:', req.body);
    next();
  },
  companyController.createCompany
);

router.get('/', companyController.getAllCompanies);
router.get('/:id', companyController.getCompanyById);
router.put('/:id', companyController.updateCompany);
router.patch('/:id/status', companyController.updateCompanyStatus);
router.get('/:id/stats', companyController.getCompanyStats);

module.exports = router;