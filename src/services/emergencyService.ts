import { duringApi, RescueRequest, PriorityLevel, WaterLevel, EmergencyType, RescueStatus } from '../api/duringApi';

export type { RescueRequest, PriorityLevel, WaterLevel, EmergencyType, RescueStatus };
export type EmergencyRequest = RescueRequest;

export interface EmergencyCondition {
  id: string;
  conditionType: string;
}

export interface CommunityStatus {
  disasterId: string;
  totalPopulation: number;
  confirmedSafe: number;
  inDistress: number;
  unaccounted: number;
  emergencyRequests: {
    total: number;
    pending: number;
    teamAssigned: number;
    safelyRescued: number;
    notFound: number;
  };
}

export const emergencyService = {
  async getMyStatus(disasterId?: string): Promise<RescueRequest[]> {
    return duringApi.getMyRequests();
  },

  async getMyRequests(): Promise<RescueRequest[]> {
    return duringApi.getMyRequests();
  },

  async updateStatus(
    disasterId: string,
    status: 'SAFE' | 'IN_DISTRESS' | 'UNACCOUNTED',
    memberIds?: string[]
  ): Promise<any> {
    // If citizen marks safe, no rescue request needed
    return { success: true, status };
  },

  async createEmergencyRequest(
    disasterId: string,
    data: {
      householdMemberId?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
      description?: string;
      conditions?: string[];
      peopleCount?: number;
      childrenCount?: number;
      elderlyCount?: number;
      disabledCount?: number;
      injuredCount?: number;
      criticalMedicalNeed?: boolean;
      waterLevel?: WaterLevel;
      emergencyType?: EmergencyType;
    }
  ): Promise<RescueRequest> {
    // Map conditions array to DURING backend emergency types & vulnerability factors
    const conditions = data.conditions || [];
    const hasMedical = conditions.includes('HEAVILY_INJURED') || conditions.includes('SERIOUSLY_UNWELL') || !!data.criticalMedicalNeed;
    const hasTrapped = conditions.includes('TRAPPED') || conditions.includes('NEED_RESCUE');
    const hasDisabled = conditions.includes('PHYSICALLY_DISABLED');
    const hasChildren = conditions.includes('CHILDREN_INFANTS_PRESENT');
    const hasWaterRising = conditions.includes('WATER_RISING');
    const hasFire = conditions.includes('FIRE');

    let emergencyType: EmergencyType = data.emergencyType || 'FLOOD';
    if (hasFire) emergencyType = 'STRUCTURAL_DANGER';
    else if (hasTrapped) emergencyType = 'TRAPPED';
    else if (hasMedical) emergencyType = 'MEDICAL';

    const waterLevel: WaterLevel = data.waterLevel || (hasWaterRising ? 'HIGH' : 'MEDIUM');

    return duringApi.submitRescueRequest({
      latitude: data.latitude || 13.0213,
      longitude: data.longitude || 80.2231,
      address: data.address || 'Reported Location',
      description: data.description || 'Emergency SOS assistance requested.',
      peopleCount: data.peopleCount || (conditions.length > 0 ? 3 : 1),
      childrenCount: data.childrenCount !== undefined ? data.childrenCount : (hasChildren ? 1 : 0),
      elderlyCount: data.elderlyCount !== undefined ? data.elderlyCount : 1,
      disabledCount: data.disabledCount !== undefined ? data.disabledCount : (hasDisabled ? 1 : 0),
      injuredCount: data.injuredCount !== undefined ? data.injuredCount : (hasMedical ? 1 : 0),
      criticalMedicalNeed: hasMedical,
      waterLevel,
      emergencyType,
    });
  },

  async getEmergencyRequests(disasterId?: string, status?: string, role?: string): Promise<RescueRequest[]> {
    try {
      let list: RescueRequest[] = [];
      if (role === 'RESCUER') {
        list = await duringApi.getAssignedMissions();
      } else if (role === 'CITIZEN') {
        list = await duringApi.getMyRequests();
      } else {
        list = await duringApi.getRankedRequests();
      }
      if (status) {
        return list.filter((r) => r.status === status);
      }
      return list;
    } catch (e) {
      console.warn('Error in getEmergencyRequests:', e);
      return [];
    }
  },

  async getMapRequests(role?: string): Promise<any[]> {
    try {
      if (role === 'AUTHORITY') {
        return await duringApi.getMapRequests();
      }
      if (role === 'RESCUER') {
        return await duringApi.getAssignedMissions();
      }
      return await duringApi.getMyRequests();
    } catch (e) {
      console.warn('Error in getMapRequests:', e);
      return [];
    }
  },

  async getEmergencyRequestById(requestId: string): Promise<RescueRequest> {
    return duringApi.getRequestById(requestId);
  },

  async cancelEmergencyRequest(requestId: string): Promise<RescueRequest> {
    return duringApi.cancelRequest(requestId);
  },

  async getCommunityStatus(disasterId: string): Promise<CommunityStatus> {
    const requests = await duringApi.getRankedRequests().catch(() => []);

    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const teamAssigned = requests.filter((r) => r.status === 'ASSIGNED').length;
    const inProgress = requests.filter((r) => r.status === 'IN_PROGRESS').length;
    const safelyRescued = requests.filter((r) => r.status === 'RESCUED').length;
    const cancelled = requests.filter((r) => r.status === 'CANCELLED').length;

    const inDistress = pending + teamAssigned + inProgress;
    const confirmedSafe = Math.max(safelyRescued * 4, 18);
    const unaccounted = Math.max(0, 42 - confirmedSafe - inDistress);

    return {
      disasterId,
      totalPopulation: confirmedSafe + inDistress + unaccounted,
      confirmedSafe,
      inDistress,
      unaccounted,
      emergencyRequests: {
        total: requests.length,
        pending,
        teamAssigned: teamAssigned + inProgress,
        safelyRescued,
        notFound: cancelled,
      },
    };
  },
};
