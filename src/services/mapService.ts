import { beforeApi } from '../api/beforeApi';
import { duringApi } from '../api/duringApi';
import { Shelter } from './shelterService';
import { EmergencyFacility } from './facilityService';
import { AffectedZone, disasterService } from './disasterService';

export interface Road {
  id: string;
  name: string;
  status: 'OPEN' | 'FLOODED' | 'BLOCKED' | 'RESTRICTED';
  coordinatesJson: string;
}

export interface CitizenMapResponse {
  registeredHome: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    membersCount: number;
    members: any[];
  };
  radiusKm: number;
  shelters: (Shelter & {
    distanceKm: number;
    expectedArrivals?: number;
    remainingCapacity?: number;
    occupancyPercentage?: number;
  })[];
  facilities: {
    hospitals: (EmergencyFacility & { distanceKm: number })[];
    fireStations: (EmergencyFacility & { distanceKm: number })[];
    policeStations: (EmergencyFacility & { distanceKm: number })[];
    checkpoints: (EmergencyFacility & { distanceKm: number })[];
  };
  roads: Road[];
  zones: AffectedZone[];
  osmStatus?: {
    source: string;
    totalDiscovered?: number;
    error?: string;
  };
}

export interface RescuerMapResponse {
  households: any[];
  shelters: Shelter[];
  facilities: EmergencyFacility[];
  roads: Road[];
  zones: AffectedZone[];
  emergencyRequests: any[];
}

function isValidCoordinate(lat: any, lng: any): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
}

/**
 * Deterministically generates a demo emergency contact number based on facility ID and type.
 * Hospital: 080-4000-1001 to 080-4000-1999
 * Fire Station: 080-4000-2001 to 080-4000-2999
 * Police Station: 080-4000-3001 to 080-4000-3999
 */
export function generateDemoEmergencyContact(facilityId: string, type: string): string {
  let hash = 0;
  const seed = `${type}:${facilityId}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const offset = (Math.abs(hash) % 999) + 1; // 1 to 999
  let typePrefix = '1';
  const uType = (type || '').toUpperCase();
  if (uType.includes('FIRE')) {
    typePrefix = '2';
  } else if (uType.includes('POLICE')) {
    typePrefix = '3';
  } else if (uType.includes('HOSP') || uType.includes('HEALTH')) {
    typePrefix = '1';
  } else {
    typePrefix = '4';
  }
  return `080-4000-${typePrefix}${offset.toString().padStart(3, '0')}`;
}

export const mapService = {
  async getCitizenMap(disasterId?: string): Promise<CitizenMapResponse> {
    try {
      // Fetch citizen map, household details, disaster zones, and live shelter occupancy in parallel
      const [rawMap, myHousehold, zones, shelterOccupancies] = await Promise.all([
        beforeApi.getCitizenMap(disasterId).catch(() => null),
        beforeApi.getMyHousehold().catch(() => null),
        disasterId ? disasterService.getAffectedZones(disasterId).catch(() => []) : Promise.resolve([]),
        disasterId ? beforeApi.getShelterOccupancy(disasterId).catch(() => []) : Promise.resolve([]),
      ]);

      const center = rawMap?.center || rawMap?.registeredHome;
      let homeLat = Number(center?.latitude ?? myHousehold?.latitude ?? 12.9352);
      let homeLon = Number(center?.longitude ?? myHousehold?.longitude ?? 77.6245);
      if (!isValidCoordinate(homeLat, homeLon)) {
        homeLat = 12.9352;
        homeLon = 77.6245;
      }

      const homeName = center?.buildingNameOrNumber || myHousehold?.name || 'Palm Meadows Villa 101';
      const homeAddress = center?.address
        ? `${center.address}${center.city ? `, ${center.city}` : ''}`
        : (myHousehold?.address || 'Koramangala 4th Block, Bengaluru');
      const members = Array.isArray(myHousehold?.members)
        ? myHousehold.members
        : Array.isArray(center?.members)
        ? center.members
        : [];
      const membersCount = myHousehold?.stats?.totalMembers ?? members.length ?? 5;

      const registeredHome = {
        id: center?.householdId || myHousehold?.id || 'home',
        name: homeName,
        address: homeAddress,
        latitude: homeLat,
        longitude: homeLon,
        membersCount,
        members,
      };

      // Map live occupancy to shelters
      const occupancyMap = new Map<string, any>();
      if (Array.isArray(shelterOccupancies)) {
        shelterOccupancies.forEach((occ: any) => {
          if (occ && occ.id) occupancyMap.set(occ.id, occ);
        });
      }

      const rawShelters = Array.isArray(rawMap?.shelters) ? rawMap.shelters : [];
      const shelters = rawShelters
        .filter((s: any) => s && isValidCoordinate(s.latitude, s.longitude))
        .map((s: any) => {
          const occ = occupancyMap.get(s.id);
          const capacity = Number(s.capacity ?? occ?.capacity ?? 500);
          const expectedArrivals = occ ? Number(occ.expectedArrivals ?? 0) : 0;
          const remainingCapacity = occ
            ? Number(occ.remainingCapacity ?? (capacity - expectedArrivals))
            : capacity;
          const status = occ?.status || s.status || 'AVAILABLE';
          const distanceKm = Number.isFinite(Number(s.distanceKm)) ? Number(s.distanceKm) : 0;

          return {
            id: s.id,
            name: s.name || 'Shelter',
            address: s.address || '',
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
            capacity,
            contactNumber: s.contactNumber || '',
            status,
            distanceKm,
            expectedArrivals,
            remainingCapacity,
            occupancyPercentage:
              occ?.occupancyPercentage ??
              (capacity > 0 ? Math.round((expectedArrivals / capacity) * 100) : 0),
          };
        });

      const mapFacility = (f: any, type: 'HOSPITAL' | 'FIRE_STATION' | 'POLICE_STATION' | 'CHECKPOINT') => {
        const lat = Number(f.latitude);
        const lng = Number(f.longitude);
        const distanceKm = Number.isFinite(Number(f.distanceKm)) ? Number(f.distanceKm) : 0;
        const facilityId = f.id || `${type}-${Math.random().toString(36).slice(2, 9)}`;
        const demoContact = f.emergencyContact || generateDemoEmergencyContact(facilityId, type);
        return {
          id: facilityId,
          name: typeof f.name === 'string' && f.name.trim() ? f.name.trim() : `Unnamed ${type}`,
          type,
          address: typeof f.address === 'string' ? f.address : '',
          latitude: lat,
          longitude: lng,
          contactNumber: demoContact,
          emergencyContact: demoContact,
          emergencyContactIsDemo: true,
          phone: f.phone || demoContact || null,
          distanceKm,
          source: f.source || 'OpenStreetMap',
        };
      };

      const rawHospitals = Array.isArray(rawMap?.hospitals)
        ? rawMap.hospitals
        : Array.isArray(rawMap?.facilities?.hospitals)
        ? rawMap.facilities.hospitals
        : [];
      const rawFire = Array.isArray(rawMap?.fireStations)
        ? rawMap.fireStations
        : Array.isArray(rawMap?.facilities?.fireStations)
        ? rawMap.facilities.fireStations
        : [];
      const rawPolice = Array.isArray(rawMap?.policeStations)
        ? rawMap.policeStations
        : Array.isArray(rawMap?.facilities?.policeStations)
        ? rawMap.facilities.policeStations
        : [];
      const rawCheckpoints = Array.isArray(rawMap?.checkpoints)
        ? rawMap.checkpoints
        : Array.isArray(rawMap?.facilities?.checkpoints)
        ? rawMap.facilities.checkpoints
        : [];

      const facilities = {
        hospitals: rawHospitals
          .filter((f: any) => f && isValidCoordinate(f.latitude, f.longitude))
          .map((f: any) => mapFacility(f, 'HOSPITAL')),
        fireStations: rawFire
          .filter((f: any) => f && isValidCoordinate(f.latitude, f.longitude))
          .map((f: any) => mapFacility(f, 'FIRE_STATION')),
        policeStations: rawPolice
          .filter((f: any) => f && isValidCoordinate(f.latitude, f.longitude))
          .map((f: any) => mapFacility(f, 'POLICE_STATION')),
        checkpoints: rawCheckpoints
          .filter((f: any) => f && isValidCoordinate(f.latitude, f.longitude))
          .map((f: any) => mapFacility(f, 'CHECKPOINT')),
      };

      return {
        registeredHome,
        radiusKm: Number(rawMap?.radiusKm || 5.0),
        shelters,
        facilities,
        roads: [],
        zones: Array.isArray(zones) ? zones : [],
        osmStatus: rawMap?.osmStatus || { source: 'OpenStreetMap' },
      };
    } catch (err) {
      console.error('Error constructing citizen map data:', err);
      // Clean fallback using Priya Sharma's real registered home
      return {
        registeredHome: {
          id: '00000000-0000-0000-0000-000000000401',
          name: 'Palm Meadows Villa 101',
          address: 'Koramangala 4th Block, Bengaluru',
          latitude: 12.9352,
          longitude: 77.6245,
          membersCount: 5,
          members: [],
        },
        radiusKm: 5.0,
        shelters: [],
        facilities: { hospitals: [], fireStations: [], policeStations: [], checkpoints: [] },
        roads: [],
        zones: [],
      };
    }
  },

  async getRescuerMap(disasterId?: string): Promise<RescuerMapResponse> {
    try {
      const [rawRescuer, shelters, facilities, zones] = await Promise.all([
        beforeApi.getRescuerMap(disasterId).catch(() => null),
        disasterId
          ? beforeApi.getShelterOccupancy(disasterId).catch(() => [])
          : beforeApi.getShelters().catch(() => []),
        beforeApi.getFacilities().catch(() => []),
        disasterId ? disasterService.getAffectedZones(disasterId).catch(() => []) : Promise.resolve([]),
      ]);

      const rawHouses = Array.isArray(rawRescuer?.houses)
        ? rawRescuer.houses
        : Array.isArray(rawRescuer?.households)
        ? rawRescuer.households
        : [];

      const safeHouses = rawHouses.filter((h: any) => {
        const lat = h?.latitude ?? h?.registeredHomeLocation?.latitude;
        const lng = h?.longitude ?? h?.registeredHomeLocation?.longitude;
        return isValidCoordinate(lat, lng);
      });

      // Unpack facilities from array, { facilities: [...] }, or { data: { facilities: [...] } }
      const rawFacList: any[] = Array.isArray(facilities)
        ? facilities
        : Array.isArray((facilities as any)?.facilities)
        ? (facilities as any).facilities
        : Array.isArray((facilities as any)?.data?.facilities)
        ? (facilities as any).data.facilities
        : [];

      // Collect and deduplicate all facilities across /facilities and houses' nearby facilities
      const facilityMap = new Map<string, any>();

      rawFacList.forEach((f: any) => {
        if (f && isValidCoordinate(f.latitude, f.longitude)) {
          const key = f.id || `${f.name}-${f.latitude}-${f.longitude}`;
          facilityMap.set(key, f);
        }
      });

      if (Array.isArray(rawHouses)) {
        rawHouses.forEach((h: any) => {
          const nf = h?.nearbyFacilities;
          if (nf) {
            ['hospitals', 'fireStations', 'policeStations', 'checkpoints'].forEach((catKey) => {
              if (Array.isArray(nf[catKey])) {
                nf[catKey].forEach((f: any) => {
                  if (f && isValidCoordinate(f.latitude, f.longitude)) {
                    const key = f.id || `${f.name}-${f.latitude}-${f.longitude}`;
                    if (!facilityMap.has(key)) {
                      facilityMap.set(key, f);
                    }
                  }
                });
              }
            });
          }
        });
      }

      const safeFacilities = Array.from(facilityMap.values()).map((f: any) => {
        const demoContact = f.emergencyContact || generateDemoEmergencyContact(f.id, f.type);
        return {
          id: f.id || `fac-${Math.random().toString(36).slice(2, 9)}`,
          name: f.name || 'Emergency Facility',
          type: f.type || 'FACILITY',
          address: f.address || '',
          latitude: Number(f.latitude),
          longitude: Number(f.longitude),
          contactNumber: f.contactNumber || demoContact,
          emergencyContact: demoContact,
          emergencyContactIsDemo: true,
          phone: f.phone || demoContact || null,
          source: f.source || 'Official Response Network',
        };
      });

      const safeShelters = (Array.isArray(shelters) ? shelters : []).filter(
        (s: any) => s && isValidCoordinate(s.latitude, s.longitude)
      );

      return {
        households: safeHouses,
        shelters: safeShelters,
        facilities: safeFacilities,
        roads: [],
        zones: Array.isArray(zones) ? zones : [],
        emergencyRequests: Array.isArray(rawRescuer?.emergencyRequests) ? rawRescuer.emergencyRequests : [],
      };
    } catch (err) {
      console.error('Error fetching rescuer map data:', err);
      return {
        households: [],
        shelters: [],
        facilities: [],
        roads: [],
        zones: [],
        emergencyRequests: [],
      };
    }
  },

  async getDuringMapRequests() {
    return duringApi.getMapRequests();
  },
};
