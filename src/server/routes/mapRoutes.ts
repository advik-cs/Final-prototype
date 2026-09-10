import { Router } from 'express';
import { getCitizenMapData, getRescuerMapData } from '../controllers/mapController.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

// Citizen map within 5km of registered home
router.get('/map/citizen', requireAuth, getCitizenMapData);

// Rescuer map with all registered houses & 5km facility coverage
router.get('/map/rescuer', requireAuth, requireRole(['RESCUER', 'AUTHORITY']), getRescuerMapData);

export default router;
