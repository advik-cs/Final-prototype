import { duringApi, RescueRequest, RescueTeam, RescueStatus } from '../api/duringApi';

export interface RescueAssignment {
  id: string;
  emergencyRequestId: string;
  teamName: string;
  assignedByUserId?: string;
  assignedAt: string;
  status: string;
  notes?: string;
}

export const rescueService = {
  async getAvailableTeams(): Promise<RescueTeam[]> {
    return duringApi.getAvailableTeams();
  },

  async getAllTeams(): Promise<RescueTeam[]> {
    return duringApi.getTeams();
  },

  async assignTeam(
    requestId: string,
    teamIdOrName: string,
    notes?: string
  ): Promise<{ message: string; assignment?: any; request?: RescueRequest }> {
    let teamId = teamIdOrName;
    // If a name was passed rather than a UUID, find matching team from available teams
    if (!teamIdOrName.includes('-')) {
      const teams = await duringApi.getAvailableTeams().catch(() => []);
      const matched = teams.find((t) => t.name.toLowerCase().includes(teamIdOrName.toLowerCase()));
      if (matched) {
        teamId = matched.id;
      } else if (teams.length > 0) {
        teamId = teams[0].id;
      }
    }

    const res = await duringApi.assignTeam(requestId, teamId);
    return {
      message: 'Rescue team successfully assigned',
      assignment: {
        id: res.id,
        emergencyRequestId: requestId,
        teamName: res.team?.name || 'Rescue Squad',
        assignedAt: new Date().toISOString(),
        status: 'ASSIGNED',
        notes,
      },
    };
  },

  async updateRescueStatus(
    requestId: string,
    rescueStatus: RescueStatus | 'TEAM_ASSIGNED' | 'SAFELY_RESCUED' | 'NOT_FOUND',
    notes?: string
  ): Promise<RescueRequest> {
    if (rescueStatus === 'SAFELY_RESCUED' || rescueStatus === 'RESCUED') {
      return duringApi.updateMissionStatus(requestId, 'RESCUED');
    }
    if (rescueStatus === 'IN_PROGRESS') {
      return duringApi.updateMissionStatus(requestId, 'IN_PROGRESS');
    }
    if (rescueStatus === 'ACKNOWLEDGED') {
      return duringApi.updateAuthorityRequestStatus(requestId, 'ACKNOWLEDGED');
    }
    if (rescueStatus === 'CANCELLED' || rescueStatus === 'NOT_FOUND') {
      return duringApi.updateAuthorityRequestStatus(requestId, 'CANCELLED');
    }

    // Default fallback
    return duringApi.getRequestById(requestId);
  },

  async getAssignedMissions(): Promise<RescueRequest[]> {
    return duringApi.getAssignedMissions();
  },

  async updateLocation(latitude: number, longitude: number): Promise<any> {
    return duringApi.updateRescuerLocation(latitude, longitude);
  },
};
