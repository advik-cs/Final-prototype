import { Router } from 'express';
import {
  createDisaster,
  getDisasters,
  getDisasterById,
  updateDisaster,
  deleteDisaster,
  addAffectedZone,
  getAffectedZones,
  updateAffectedZone,
  deleteAffectedZone,
  getAffectedHouseholds,
  setExpectedLocations,
  getExpectedLocations,
  updateSingleExpectedLocation,
  getBuildingIntelligence,
  getZoneSummary,
  submitReconfirmation,
  getReconfirmationStatus,
} from '../controllers/disasterController.ts';
import { getShelterOccupancy } from '../controllers/shelterController.ts';
import {
  getMyStatus,
  updateStatus,
  createEmergencyRequest,
  getEmergencyRequests,
  getCommunityStatus,
  getBuildingLiveStatus,
  getZoneLiveStatus,
} from '../controllers/emergencyController.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

// Disasters
router.post('/disasters', requireAuth, requireRole('RESCUER'), createDisaster);
router.get('/disasters', requireAuth, getDisasters);
router.get('/disasters/:id', requireAuth, getDisasterById);
router.put('/disasters/:id', requireAuth, requireRole('RESCUER'), updateDisaster);
router.delete('/disasters/:id', requireAuth, requireRole('RESCUER'), deleteDisaster);

// Affected Zones
router.post('/disasters/:id/zones', requireAuth, requireRole('RESCUER'), addAffectedZone);
router.get('/disasters/:id/zones', requireAuth, getAffectedZones);
router.put('/disasters/:id/zones/:zoneId', requireAuth, requireRole('RESCUER'), updateAffectedZone);
router.delete('/disasters/:id/zones/:zoneId', requireAuth, requireRole('RESCUER'), deleteAffectedZone);
router.get('/disasters/:id/affected-households', requireAuth, getAffectedHouseholds);

// Expected Locations
router.post('/disasters/:id/expected-locations', requireAuth, setExpectedLocations);
router.get('/disasters/:id/expected-locations', requireAuth, getExpectedLocations);
router.put('/disasters/:id/expected-locations/:memberId', requireAuth, updateSingleExpectedLocation);

// Shelter Occupancy for Disaster
router.get('/disasters/:id/shelter-occupancy', requireAuth, getShelterOccupancy);

// Building Intelligence & Zone Summary
router.get('/disasters/:id/buildings', requireAuth, getBuildingIntelligence);
router.get('/disasters/:id/zone-summary', requireAuth, getZoneSummary);

// Reconfirmation
router.post('/disasters/:id/reconfirm', requireAuth, submitReconfirmation);
router.get('/disasters/:id/reconfirmation-status', requireAuth, getReconfirmationStatus);
router.get('/disasters/:id/reconfirmation/my-status', requireAuth, getReconfirmationStatus);
router.get('/disasters/:id/reconfirmations/status', requireAuth, getReconfirmationStatus);

// Live Emergency Status & Requests within Disaster
router.get('/disasters/:id/my-status', requireAuth, getMyStatus);
router.post('/disasters/:id/status', requireAuth, updateStatus);
router.post('/disasters/:id/emergency-requests', requireAuth, createEmergencyRequest);
router.get('/disasters/:id/emergency-requests', requireAuth, getEmergencyRequests);

// Community Live Summaries
router.get('/disasters/:id/community-status', requireAuth, getCommunityStatus);
router.get('/disasters/:id/buildings/:buildingId/live-status', requireAuth, getBuildingLiveStatus);
router.get('/disasters/:id/zones/:zoneId/live-status', requireAuth, getZoneLiveStatus);

export default router;
