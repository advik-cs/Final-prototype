import { beforeApi, Shelter, ShelterOccupancy } from '../api/beforeApi';

export type { Shelter, ShelterOccupancy };

export const shelterService = {
  async getShelters(): Promise<Shelter[]> {
    return beforeApi.getShelters();
  },

  async getShelterOccupancy(disasterId: string): Promise<ShelterOccupancy[]> {
    return beforeApi.getShelterOccupancy(disasterId);
  },

  async createShelter(data: Partial<Shelter>): Promise<Shelter> {
    return beforeApi.createShelter(data);
  },

  async updateShelter(id: string, data: Partial<Shelter>): Promise<Shelter> {
    return beforeApi.updateShelter(id, data);
  },
};
