import { Router } from 'express';
import {
  createShelter,
  getShelters,
  getShelterById,
  updateShelter,
  deleteShelter,
  getShelterOccupancy,
} from '../controllers/shelterController.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

router.post('/shelters', requireAuth, requireRole('RESCUER'), createShelter);
router.get('/shelters', requireAuth, getShelters);
router.get('/shelters/occupancy/:id', requireAuth, getShelterOccupancy);
router.get('/shelters/:id/occupancy', requireAuth, getShelterOccupancy);
router.get('/shelters/:id', requireAuth, getShelterById);
router.put('/shelters/:id', requireAuth, requireRole('RESCUER'), updateShelter);
router.delete('/shelters/:id', requireAuth, requireRole('RESCUER'), deleteShelter);

export default router;
