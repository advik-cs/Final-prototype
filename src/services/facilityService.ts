import { request } from './apiClient.ts';

export interface EmergencyFacility {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'FIRE_STATION' | 'POLICE_STATION' | 'CHECKPOINT';
  address: string;
  latitude: number;
  longitude: number;
  contactNumber: string;
  emergencyContact?: string;
  emergencyContactIsDemo?: boolean;
  phone?: string | null;
  source?: string;
}

export const facilityService = {
  async getFacilities(type?: string): Promise<EmergencyFacility[]> {
    return request<EmergencyFacility[]>(`/facilities${type ? `?type=${type}` : ''}`);
  },

  async createFacility(data: Partial<EmergencyFacility>): Promise<EmergencyFacility> {
    return request<EmergencyFacility>('/facilities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFacility(id: string, data: Partial<EmergencyFacility>): Promise<EmergencyFacility> {
    return request<EmergencyFacility>(`/facilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteFacility(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/facilities/${id}`, {
      method: 'DELETE',
    });
  },
};
