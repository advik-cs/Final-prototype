import { Router } from 'express';
import {
  getEmergencyRequestById,
  updateEmergencyRequest,
} from '../controllers/emergencyController.ts';
import {
  assignRescueTeam,
  updateRescueStatus,
  getPriorityConfigs,
  updatePriorityConfig,
  createRescueRequest,
  getMyRescueRequests,
  getRescueRequestByIdUnified,
  cancelRescueRequest,
  getRankedRescueRequests,
  getMapRescueRequests,
  getAvailableRescueTeams,
  getAssignedMissions,
} from '../controllers/rescueController.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

// Citizen SOS & Rescue Requests
router.post('/rescue-requests', requireAuth, createRescueRequest);
router.get('/rescue-requests/my', requireAuth, getMyRescueRequests);
router.get('/rescue-requests/:id', requireAuth, getRescueRequestByIdUnified);
router.patch('/rescue-requests/:id/cancel', requireAuth, cancelRescueRequest);
router.post('/rescue-requests/:id/cancel', requireAuth, cancelRescueRequest);

// Authority & Rescuer During Operations
router.get('/authority/rescue-requests/ranked', requireAuth, getRankedRescueRequests);
router.get('/authority/map/rescue-requests', requireAuth, getMapRescueRequests);
router.get('/authority/rescue-teams/available', requireAuth, getAvailableRescueTeams);
router.post('/authority/rescue-requests/:id/assign', requireAuth, assignRescueTeam);
router.get('/rescuer/missions/assigned', requireAuth, getAssignedMissions);
router.patch('/rescuer/missions/:id/status', requireAuth, updateRescueStatus);

// Single emergency request lookup and edits
router.get('/emergency-requests/:requestId', requireAuth, getEmergencyRequestById);
router.put('/emergency-requests/:requestId', requireAuth, updateEmergencyRequest);

// Rescue assignment and status lifecycle (Rescuer only)
router.post('/emergency-requests/:requestId/assign', requireAuth, requireRole('RESCUER'), assignRescueTeam);
router.put('/emergency-requests/:requestId/rescue-status', requireAuth, requireRole('RESCUER'), updateRescueStatus);

// Priority configuration
router.get('/priority-config', requireAuth, getPriorityConfigs);
router.put('/priority-config/:id', requireAuth, requireRole('RESCUER'), updatePriorityConfig);

export default router;
