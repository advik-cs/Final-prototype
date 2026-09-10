export type UserRole = 'CITIZEN' | 'RESCUER' | 'AUTHORITY';

export type DisasterType = 'FLOOD' | 'CYCLONE' | 'EARTHQUAKE' | 'LANDSLIDE' | 'OTHER';

export type AlertLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type DisasterStatus = 'PREDICTED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export type MemberCategory = 'ADULT' | 'CHILD' | 'ELDERLY';

export type ExpectedLocationType = 'HOME' | 'SHELTER' | 'OTHER_CITY' | 'UNKNOWN';

export type ReconfirmationChoice = 'SAME_PLAN' | 'CHANGE_LOCATION' | 'NOT_SURE';

export type ShelterStatus = 'ACTIVE' | 'NEAR_CAPACITY' | 'FULL' | 'CLOSED';

export type FacilityType = 'HOSPITAL' | 'FIRE_STATION' | 'POLICE_STATION' | 'CHECKPOINT';

export type EmergencyStatusType = 'SAFE' | 'IN_DISTRESS' | 'UNACCOUNTED';

export type EmergencyConditionType =
  | 'TRAPPED'
  | 'HEAVILY_INJURED'
  | 'WATER_RISING'
  | 'FIRE'
  | 'PHYSICALLY_DISABLED'
  | 'CHILDREN_INFANTS_PRESENT'
  | 'SERIOUSLY_UNWELL'
  | 'NEED_RESCUE'
  | 'OTHER';

export type RescueStatusType = 'PENDING' | 'TEAM_ASSIGNED' | 'SAFELY_RESCUED' | 'NOT_FOUND';

export type NotificationType =
  | 'DISASTER_ALERT'
  | 'EXPECTED_LOCATION_REQUEST'
  | 'RECONFIRMATION'
  | 'SHELTER_UPDATE';

export interface JwtAuthPayload {
  userId: string;
  role: UserRole;
  name: string;
}
