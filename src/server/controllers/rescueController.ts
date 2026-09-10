import { Response } from 'express';
import prisma from '../config/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function assignRescueTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;
    const { teamName, notes } = req.body;
    const userId = req.user!.userId;

    if (!teamName) {
      res.status(400).json({ error: 'Team name is required.' });
      return;
    }

    const request = await prisma.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { householdMember: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Emergency request not found.' });
      return;
    }

    const assignment = await prisma.rescueAssignment.create({
      data: {
        emergencyRequestId: requestId,
        teamName: String(teamName).trim(),
        assignedByUserId: userId,
        status: 'TEAM_ASSIGNED',
        notes: notes ? String(notes).trim() : 'Rapid dispatch initialized',
      },
    });

    // Update emergency request rescueStatus
    const updatedRequest = await prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        rescueStatus: 'TEAM_ASSIGNED',
      },
      include: {
        conditions: true,
        rescueAssignments: {
          orderBy: { assignedAt: 'desc' },
        },
        householdMember: {
          include: { household: true },
        },
      },
    });

    res.status(201).json({
      message: 'Rescue team successfully assigned',
      assignment,
      request: updatedRequest,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to assign rescue team.' });
  }
}

export async function updateRescueStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;
    const { rescueStatus, notes } = req.body;

    const validStatuses = ['PENDING', 'TEAM_ASSIGNED', 'SAFELY_RESCUED', 'NOT_FOUND'];
    if (!rescueStatus || !validStatuses.includes(rescueStatus)) {
      res.status(400).json({
        error: `Invalid rescue status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const request = await prisma.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { householdMember: true },
    });

    if (!request) {
      res.status(404).json({ error: 'Emergency request not found.' });
      return;
    }

    // If marked SAFELY_RESCUED, automatically update EmergencyStatus to SAFE!
    if (rescueStatus === 'SAFELY_RESCUED') {
      await prisma.emergencyStatus.upsert({
        where: {
          disasterId_householdMemberId: {
            disasterId: request.disasterId,
            householdMemberId: request.householdMemberId,
          },
        },
        update: {
          status: 'SAFE',
          updatedAt: new Date(),
        },
        create: {
          disasterId: request.disasterId,
          householdMemberId: request.householdMemberId,
          status: 'SAFE',
        },
      });
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id: requestId },
      data: {
        rescueStatus,
      },
      include: {
        conditions: true,
        rescueAssignments: {
          orderBy: { assignedAt: 'desc' },
        },
        householdMember: {
          include: { household: true },
        },
      },
    });

    if (notes) {
      const latestAssignment = await prisma.rescueAssignment.findFirst({
        where: { emergencyRequestId: requestId },
        orderBy: { assignedAt: 'desc' },
      });
      if (latestAssignment) {
        await prisma.rescueAssignment.update({
          where: { id: latestAssignment.id },
          data: {
            status: rescueStatus,
            notes: String(notes).trim(),
          },
        });
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update rescue status.' });
  }
}

export async function getPriorityConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const configs = await prisma.priorityConfiguration.findMany();
    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch priority configurations.' });
  }
}

export async function updatePriorityConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { weight, isActive } = req.body;

    const updated = await prisma.priorityConfiguration.update({
      where: { id },
      data: {
        weight: weight !== undefined ? parseInt(weight, 10) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update priority configuration.' });
  }
}

// ==================== UNIFIED RESCUE REQUEST HANDLERS ====================

function formatRescueRequest(reqRecord: any, citizenUser?: any, customBreakdown?: any) {
  const score = reqRecord.priorityScore || 0;
  const level =
    score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';

  let status = reqRecord.rescueStatus || 'PENDING';
  if (status === 'TEAM_ASSIGNED') status = 'ASSIGNED';
  else if (status === 'SAFELY_RESCUED') status = 'RESCUED';

  const condTypes = reqRecord.conditions?.map((c: any) => c.conditionType) || [];
  const hasCriticalMedical = condTypes.includes('SERIOUSLY_UNWELL');
  const hasInjured = condTypes.includes('HEAVILY_INJURED');
  const hasChildren = condTypes.includes('CHILDREN_INFANTS_PRESENT');
  const hasDisabled = condTypes.includes('PHYSICALLY_DISABLED');
  const hasWaterRising = condTypes.includes('WATER_RISING');
  const hasTrapped = condTypes.includes('TRAPPED');
  const hasFire = condTypes.includes('FIRE');

  const breakdown = customBreakdown || {
    criticalMedical: hasCriticalMedical ? 25 : 0,
    injured: hasInjured ? 20 : 0,
    children: hasChildren ? 15 : 0,
    elderly: 0,
    disabled: hasDisabled ? 15 : 0,
    waterLevel: hasWaterRising ? 15 : 10,
    trappedOrStructural: hasTrapped ? 20 : hasFire ? 30 : 0,
  };

  const latestAssignment = reqRecord.rescueAssignments?.[0];

  return {
    id: reqRecord.id,
    citizenId: citizenUser?.id || reqRecord.householdMember?.household?.userId || 'unknown',
    latitude: reqRecord.latitude,
    longitude: reqRecord.longitude,
    address: reqRecord.address || 'Bengaluru',
    description: reqRecord.description || 'Urgent assistance requested',
    peopleCount: 1,
    childrenCount: hasChildren ? 1 : 0,
    elderlyCount: 0,
    disabledCount: hasDisabled ? 1 : 0,
    injuredCount: hasInjured ? 1 : 0,
    criticalMedicalNeed: hasCriticalMedical,
    waterLevel: hasWaterRising ? 'HIGH' : 'MEDIUM',
    emergencyType: hasTrapped ? 'TRAPPED' : hasFire ? 'FIRE' : 'FLOOD',
    priorityScore: score,
    priorityLevel: level,
    status,
    priorityBreakdown: breakdown,
    teamId: latestAssignment?.teamName || null,
    team: latestAssignment
      ? {
          id: latestAssignment.id,
          name: latestAssignment.teamName,
          type: 'Rapid Response Unit',
          capacity: 6,
          currentLatitude: reqRecord.latitude,
          currentLongitude: reqRecord.longitude,
          status: 'BUSY',
          contactNumber: '+91 80 2297 1500',
        }
      : null,
    citizen: {
      id: citizenUser?.id || reqRecord.householdMember?.household?.userId || 'unknown',
      name: citizenUser?.name || reqRecord.householdMember?.household?.user?.name || reqRecord.householdMember?.name || 'Citizen',
      phone: citizenUser?.mobileNumber || reqRecord.householdMember?.household?.user?.mobileNumber || undefined,
    },
    assignedById: latestAssignment?.assignedByUserId || null,
    assignedAt: latestAssignment?.assignedAt ? latestAssignment.assignedAt.toISOString() : null,
    rescuedAt: status === 'RESCUED' ? reqRecord.updatedAt?.toISOString() : null,
    createdAt: reqRecord.createdAt ? reqRecord.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: reqRecord.updatedAt ? reqRecord.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function createRescueRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const {
      latitude,
      longitude,
      address,
      description,
      peopleCount = 1,
      childrenCount = 0,
      elderlyCount = 0,
      disabledCount = 0,
      injuredCount = 0,
      criticalMedicalNeed = false,
      waterLevel = 'MEDIUM',
      emergencyType = 'FLOOD',
    } = req.body;

    if (!address || !description) {
      res.status(400).json({ error: 'Address and description are required.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        households: {
          include: { members: true },
        },
      },
    });

    let household = user?.households?.[0];
    if (!household) {
      household = await prisma.household.create({
        data: {
          userId,
          name: `${user?.name || 'Citizen'} Household`,
          address: String(address).trim(),
          city: 'Bengaluru',
          state: 'Karnataka',
          latitude: Number(latitude) || 12.9716,
          longitude: Number(longitude) || 77.5946,
          members: {
            create: {
              name: user?.name || 'Primary Citizen',
              age: 35,
              category: 'ADULT',
              relationship: 'Self',
            },
          },
        },
        include: { members: true },
      });
    }

    let member = household.members?.[0];
    if (!member) {
      member = await prisma.householdMember.create({
        data: {
          householdId: household.id,
          name: user?.name || 'Primary Citizen',
          age: 35,
          category: 'ADULT',
          relationship: 'Self',
        },
      });
    }

    const activeDisaster =
      (await prisma.disasterEvent.findFirst({
        where: { status: { in: ['PREDICTED', 'ACTIVE', 'WARNING'] } },
        orderBy: { predictedStartTime: 'asc' },
      })) ||
      (await prisma.disasterEvent.findFirst({
        orderBy: { createdAt: 'desc' },
      }));

    if (!activeDisaster) {
      res.status(404).json({ error: 'No active disaster event found.' });
      return;
    }

    const conditionList: string[] = ['NEED_RESCUE'];
    if (criticalMedicalNeed) conditionList.push('SERIOUSLY_UNWELL');
    if (injuredCount > 0) conditionList.push('HEAVILY_INJURED');
    if (childrenCount > 0) conditionList.push('CHILDREN_INFANTS_PRESENT');
    if (disabledCount > 0) conditionList.push('PHYSICALLY_DISABLED');
    if (waterLevel === 'HIGH' || waterLevel === 'EXTREME') conditionList.push('WATER_RISING');
    if (emergencyType === 'TRAPPED') conditionList.push('TRAPPED');
    if (emergencyType === 'FIRE') conditionList.push('FIRE');

    const breakdown = {
      criticalMedical: criticalMedicalNeed ? 25 : 0,
      injured: injuredCount > 0 ? Math.min(25, Number(injuredCount) * 15) : 0,
      children: childrenCount > 0 ? Math.min(15, Number(childrenCount) * 8) : 0,
      elderly: elderlyCount > 0 ? Math.min(15, Number(elderlyCount) * 8) : 0,
      disabled: disabledCount > 0 ? Math.min(15, Number(disabledCount) * 10) : 0,
      waterLevel:
        waterLevel === 'EXTREME' ? 20 : waterLevel === 'HIGH' ? 15 : waterLevel === 'MEDIUM' ? 10 : 5,
      trappedOrStructural:
        emergencyType === 'TRAPPED' || emergencyType === 'STRUCTURAL_DANGER' ? 20 : emergencyType === 'FIRE' ? 30 : 0,
    };

    const calculatedTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const priorityScore = Math.min(100, Math.max(15, calculatedTotal));

    const requestRecord = await prisma.emergencyRequest.create({
      data: {
        disasterId: activeDisaster.id,
        householdMemberId: member.id,
        latitude: Number(latitude) || household.latitude,
        longitude: Number(longitude) || household.longitude,
        address: String(address).trim(),
        description: String(description).trim(),
        priorityScore,
        rescueStatus: 'PENDING',
        conditions: {
          create: conditionList.map((c) => ({ conditionType: c })),
        },
      },
      include: {
        conditions: true,
        rescueAssignments: true,
        householdMember: {
          include: { household: { include: { user: true } } },
        },
      },
    });

    await prisma.emergencyStatus.upsert({
      where: {
        disasterId_householdMemberId: {
          disasterId: activeDisaster.id,
          householdMemberId: member.id,
        },
      },
      update: {
        status: 'IN_DISTRESS',
        updatedAt: new Date(),
      },
      create: {
        disasterId: activeDisaster.id,
        householdMemberId: member.id,
        status: 'IN_DISTRESS',
      },
    });

    const responseData = formatRescueRequest(requestRecord, user, breakdown);
    res.status(201).json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create rescue request.' });
  }
}

export async function getMyRescueRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requests = await prisma.emergencyRequest.findMany({
      where: {
        householdMember: {
          household: { userId },
        },
      },
      include: {
        conditions: true,
        rescueAssignments: { orderBy: { assignedAt: 'desc' } },
        householdMember: {
          include: { household: { include: { user: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = requests.map((r) => formatRescueRequest(r));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch your rescue requests.' });
  }
}

export async function getRescueRequestByIdUnified(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const record = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: {
        conditions: true,
        rescueAssignments: { orderBy: { assignedAt: 'desc' } },
        householdMember: {
          include: { household: { include: { user: true } } },
        },
      },
    });

    if (!record) {
      res.status(404).json({ error: 'Rescue request not found.' });
      return;
    }

    res.json(formatRescueRequest(record));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch rescue request.' });
  }
}

export async function cancelRescueRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const record = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: { householdMember: true },
    });

    if (!record) {
      res.status(404).json({ error: 'Rescue request not found.' });
      return;
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id },
      data: { rescueStatus: 'CANCELLED' },
      include: {
        conditions: true,
        rescueAssignments: { orderBy: { assignedAt: 'desc' } },
        householdMember: {
          include: { household: { include: { user: true } } },
        },
      },
    });

    await prisma.emergencyStatus.upsert({
      where: {
        disasterId_householdMemberId: {
          disasterId: record.disasterId,
          householdMemberId: record.householdMemberId,
        },
      },
      update: {
        status: 'SAFE',
        updatedAt: new Date(),
      },
      create: {
        disasterId: record.disasterId,
        householdMemberId: record.householdMemberId,
        status: 'SAFE',
      },
    });

    res.json(formatRescueRequest(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel rescue request.' });
  }
}

export async function getRankedRescueRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requests = await prisma.emergencyRequest.findMany({
      where: {
        rescueStatus: { not: 'CANCELLED' },
      },
      include: {
        conditions: true,
        rescueAssignments: { orderBy: { assignedAt: 'desc' } },
        householdMember: {
          include: { household: { include: { user: true } } },
        },
      },
      orderBy: [
        { priorityScore: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(requests.map((r) => formatRescueRequest(r)));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch ranked requests.' });
  }
}

export async function getMapRescueRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requests = await prisma.emergencyRequest.findMany({
      where: {
        rescueStatus: { not: 'CANCELLED' },
      },
      include: {
        conditions: true,
        rescueAssignments: { orderBy: { assignedAt: 'desc' } },
      },
    });

    const markers = requests.map((r) => {
      const formatted = formatRescueRequest(r);
      return {
        id: formatted.id,
        latitude: formatted.latitude,
        longitude: formatted.longitude,
        priorityScore: formatted.priorityScore,
        priorityLevel: formatted.priorityLevel,
        status: formatted.status,
        peopleCount: formatted.peopleCount,
        emergencyType: formatted.emergencyType,
        waterLevel: formatted.waterLevel,
        shortDescription: formatted.description,
        address: formatted.address,
        createdAt: formatted.createdAt,
        assignedTeam: formatted.team,
      };
    });

    res.json(markers);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch map requests.' });
  }
}

export async function getAvailableRescueTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const defaultTeams = [
      {
        id: 'team-ndrf-1',
        name: 'NDRF 10th Battalion Alpha',
        type: 'Aquatic Search & Rescue',
        capacity: 8,
        currentLatitude: 12.9352,
        currentLongitude: 77.6245,
        status: 'AVAILABLE',
        contactNumber: '+91 80 2297 1501',
      },
      {
        id: 'team-sdrf-2',
        name: 'SDRF Rapid Boat Unit Bravo',
        type: 'Inflatable Boat Team',
        capacity: 6,
        currentLatitude: 12.9250,
        currentLongitude: 77.5938,
        status: 'AVAILABLE',
        contactNumber: '+91 80 2297 1502',
      },
      {
        id: 'team-fire-3',
        name: 'Karnataka Fire Services Rescue Charlie',
        type: 'Structural & High Water Extrication',
        capacity: 10,
        currentLatitude: 12.9716,
        currentLongitude: 77.5946,
        status: 'AVAILABLE',
        contactNumber: '+91 80 2297 1503',
      },
      {
        id: 'team-medical-4',
        name: '108 Disaster Medical Triage Delta',
        type: 'Mobile Trauma Unit',
        capacity: 4,
        currentLatitude: 12.9304,
        currentLongitude: 77.6200,
        status: 'AVAILABLE',
        contactNumber: '+91 80 2297 1504',
      },
    ];

    res.json(defaultTeams);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch rescue teams.' });
  }
}

export async function getAssignedMissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requests = await prisma.emergencyRequest.findMany({
      where: {
        rescueStatus: { in: ['TEAM_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS'] },
      },
      include: {
        conditions: true,
        rescueAssignments: { orderBy: { assignedAt: 'desc' } },
        householdMember: {
          include: { household: { include: { user: true } } },
        },
      },
      orderBy: { priorityScore: 'desc' },
    });

    res.json(requests.map((r) => formatRescueRequest(r)));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch assigned missions.' });
  }
}
