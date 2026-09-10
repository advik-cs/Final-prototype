import { Router } from 'express';
import {
  createHousehold,
  getHousehold,
  updateHousehold,
  getMembers,
  addMember,
  updateMember,
  deleteMember,
  getMyHousehold,
  getHouseholdDisasterOccupancy,
} from '../controllers/householdController.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();

// Household routes
router.get('/households/me', requireAuth, getMyHousehold);
router.post('/households', requireAuth, createHousehold);
router.get('/households/:id', requireAuth, getHousehold);
router.put('/households/:id', requireAuth, updateHousehold);

// Household members routes
router.get('/households/:id/members', requireAuth, getMembers);
router.post('/households/:id/members', requireAuth, addMember);
router.put('/households/:id/members/:memberId', requireAuth, updateMember);
router.delete('/households/:id/members/:memberId', requireAuth, deleteMember);

// Citizen profile/household stats shortcuts
router.get('/my-household', requireAuth, getMyHousehold);
router.get('/my-household/disaster/:disasterId/occupancy', requireAuth, getHouseholdDisasterOccupancy);

export default router;
