const express = require('express');
const router = express.Router();
const ctrl = require('./fee.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

router.use(authenticate);
router.get('/student/:studentId', allowRoles('SUPER_ADMIN', 'BURSARY', 'PARENT', 'STUDENT'), ctrl.getStudentFees);
router.post('/invoice', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.createInvoice);
router.post('/pay', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.recordPayment);
router.get('/receipt/:paymentId', allowRoles('SUPER_ADMIN', 'BURSARY', 'PARENT', 'STUDENT'), ctrl.getReceipt);
router.get('/outstanding', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.getOutstanding);

// Fee Configuration (Dynamic Structures) & Billing
router.get('/structures/defaults', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.getDefaultFeeSchedule);
router.get('/structures', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.getFeeStructures);
router.post('/structures', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.createFeeStructure);
router.patch('/structures/:id', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.updateFeeStructure);
router.delete('/structures/:id', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.deleteFeeStructure);
router.post('/bulk-invoice', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.bulkInvoiceClass);

module.exports = router;
