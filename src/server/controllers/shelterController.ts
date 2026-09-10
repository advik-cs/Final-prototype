import { Response } from 'express';
import prisma from '../config/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function createShelter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, address, latitude, longitude, capacity, contactNumber, status } = req.body;

    if (!name || !address || latitude === undefined || longitude === undefined || !capacity) {
      res.status(400).json({ error: 'Name, address, latitude, longitude, and capacity are required.' });
      return;
    }

    const shelter = await prisma.shelter.create({
      data: {
        name: String(name).trim(),
        address: String(address).trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        capacity: parseInt(capacity, 10),
        contactNumber: String(contactNumber || '').trim(),
        status: status || 'ACTIVE',
      },
    });

    res.status(201).json(shelter);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create shelter.' });
  }
}

export async function getShelters(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const shelters = await prisma.shelter.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(shelters);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch shelters.' });
  }
}

export async function getShelterById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const shelter = await prisma.shelter.findUnique({
      where: { id },
    });

    if (!shelter) {
      res.status(404).json({ error: 'Shelter not found.' });
      return;
    }

    res.json(shelter);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch shelter.' });
  }
}

export async function updateShelter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude, capacity, contactNumber, status } = req.body;

    const updated = await prisma.shelter.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : undefined,
        address: address ? String(address).trim() : undefined,
        latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
        capacity: capacity !== undefined ? parseInt(capacity, 10) : undefined,
        contactNumber: contactNumber !== undefined ? String(contactNumber).trim() : undefined,
        status: status || undefined,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update shelter.' });
  }
}

export async function deleteShelter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.shelter.delete({ where: { id } });
    res.json({ message: 'Shelter deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete shelter.' });
  }
}

/**
 * Dynamically calculates shelter occupancy for a specific disaster:
 * - expectedArrivals: count of household members selecting this shelter for this disaster
 * - remainingCapacity: capacity - expectedArrivals
 * - occupancy status: AVAILABLE, NEAR_CAPACITY, FULL, OVER_CAPACITY
 */
export async function getShelterOccupancy(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id: disasterId } = req.params;

    const shelters = await prisma.shelter.findMany();
    const expectedLocations = await prisma.expectedLocation.findMany({
      where: {
        disasterId,
        expectedType: 'SHELTER',
        shelterId: { not: null },
      },
    });

    // Aggregate arrivals by shelterId
    const arrivalsMap: Record<string, number> = {};
    for (const loc of expectedLocations) {
      if (loc.shelterId) {
        arrivalsMap[loc.shelterId] = (arrivalsMap[loc.shelterId] || 0) + 1;
      }
    }

    const calculated = shelters.map((s) => {
      const expectedArrivals = arrivalsMap[s.id] || 0;
      const remainingCapacity = s.capacity - expectedArrivals;

      let calculatedStatus: 'AVAILABLE' | 'NEAR_CAPACITY' | 'FULL' | 'OVER_CAPACITY' = 'AVAILABLE';

      if (expectedLocations.length === 0 && (s.status === 'OVER_CAPACITY' || s.status === 'NEAR_CAPACITY' || s.status === 'AVAILABLE')) {
        calculatedStatus = s.status as any;
      } else if (remainingCapacity < 0) {
        calculatedStatus = 'OVER_CAPACITY';
      } else if (remainingCapacity === 0) {
        calculatedStatus = 'FULL';
      } else if (remainingCapacity <= Math.max(2, s.capacity * 0.2)) {
        calculatedStatus = 'NEAR_CAPACITY';
      } else {
        calculatedStatus = 'AVAILABLE';
      }

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        capacity: s.capacity,
        contactNumber: s.contactNumber,
        expectedArrivals,
        remainingCapacity,
        occupancyPercentage: Math.min(100, Math.round((expectedArrivals / s.capacity) * 100)),
        status: calculatedStatus,
        baseStatus: s.status,
      };
    });

    res.json(calculated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate shelter occupancy.' });
  }
}
