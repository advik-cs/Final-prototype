// src/server/app.ts
import express from "express";
import cors from "cors";

// src/server/middleware/errorHandler.ts
function errorHandler(err, req, res, next) {
  console.error("[STRIDE Server Error]", err);
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    error: message,
    statusCode
  });
}

// src/server/routes/authRoutes.ts
import { Router } from "express";

// src/server/controllers/authController.ts
import bcrypt from "bcryptjs";

// src/server/config/database.ts
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
var currentDir = "";
try {
  if (typeof __dirname !== "undefined") {
    currentDir = __dirname;
  } else if (import.meta && import.meta.url) {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch {
}
if (process.env.VERCEL && (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:"))) {
  const tmpDbPath = "/tmp/dev.db";
  if (!fs.existsSync(tmpDbPath)) {
    const candidatePaths = [
      path.join(process.cwd(), "prisma", "dev.db"),
      path.join(process.cwd(), "dev.db"),
      path.resolve(process.cwd(), "prisma", "dev.db"),
      currentDir ? path.join(currentDir, "..", "..", "..", "prisma", "dev.db") : "",
      currentDir ? path.join(currentDir, "..", "..", "prisma", "dev.db") : "",
      currentDir ? path.join(currentDir, "..", "prisma", "dev.db") : "",
      currentDir ? path.join(currentDir, "prisma", "dev.db") : ""
    ].filter(Boolean);
    for (const src of candidatePaths) {
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, tmpDbPath);
          break;
        } catch (e) {
          console.warn("Could not copy dev.db to /tmp:", e);
        }
      }
    }
  }
  process.env.DATABASE_URL = `file:${tmpDbPath}`;
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}
var prisma = globalThis.prismaGlobal ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
var database_default = prisma;

// src/server/middleware/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "stride-hackathon-secure-jwt-secret-key-2026";
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. No token provided." });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session token." });
  }
}
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of role(s): ${roles.join(", ")}. Your role: ${req.user.role}`
      });
      return;
    }
    next();
  };
}

// src/server/controllers/authController.ts
async function signup(req, res) {
  try {
    const { name, testIdentityNumber, mobileNumber, password, role = "CITIZEN" } = req.body;
    if (!name || !testIdentityNumber || !mobileNumber || !password) {
      res.status(400).json({ error: "Name, test identity number, mobile number, and password are required." });
      return;
    }
    const existingUser = await database_default.user.findFirst({
      where: {
        OR: [
          { testIdentityNumber: String(testIdentityNumber).trim() },
          { mobileNumber: String(mobileNumber).trim() }
        ]
      }
    });
    if (existingUser) {
      res.status(409).json({ error: "User with this identity or mobile number already exists." });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const validRole = role === "RESCUER" ? "RESCUER" : "CITIZEN";
    const user = await database_default.user.create({
      data: {
        name: String(name).trim(),
        testIdentityNumber: String(testIdentityNumber).trim(),
        mobileNumber: String(mobileNumber).trim(),
        password: hashedPassword,
        role: validRole
      }
    });
    if (validRole === "CITIZEN") {
      try {
        const hh = await database_default.household.create({
          data: {
            name: `${user.name}'s Residence`,
            address: "42, Anna Nagar West",
            city: "Chennai",
            state: "Tamil Nadu",
            latitude: 13.085,
            longitude: 80.21,
            userId: user.id
          }
        });
        await database_default.householdMember.create({
          data: {
            name: user.name,
            age: 32,
            category: "ADULT",
            relationship: "Self (Head of Household)",
            householdId: hh.id
          }
        });
      } catch (hhErr) {
        console.warn("Household creation note:", hhErr);
      }
    }
    const token = generateToken({
      userId: user.id,
      role: validRole,
      name: user.name
    });
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        testIdentityNumber: user.testIdentityNumber,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to register user." });
  }
}
async function login(req, res) {
  try {
    const { testIdentityNumber, mobileNumber, name, password, role } = req.body;
    if (!testIdentityNumber && !mobileNumber || !password) {
      res.status(400).json({ error: "Aadhaar / Identity number or mobile number, and password are required." });
      return;
    }
    let user = await database_default.user.findFirst({
      where: {
        OR: [
          testIdentityNumber ? { testIdentityNumber: String(testIdentityNumber).trim() } : {},
          mobileNumber ? { mobileNumber: String(mobileNumber).trim() } : {}
        ]
      },
      include: {
        households: {
          include: {
            members: true
          }
        }
      }
    });
    if (!user) {
      const validRole = role === "RESCUER" ? "RESCUER" : "CITIZEN";
      const hashedPassword = await bcrypt.hash(password || "stride123", 10);
      user = await database_default.user.create({
        data: {
          name: name && String(name).trim() || "Citizen User",
          testIdentityNumber: String(testIdentityNumber || mobileNumber || "AADHAAR-" + Date.now().toString().slice(-6)).trim(),
          mobileNumber: String(mobileNumber || "9840112345").trim(),
          password: hashedPassword,
          role: validRole
        },
        include: {
          households: {
            include: {
              members: true
            }
          }
        }
      });
      if (validRole === "CITIZEN") {
        try {
          const hh = await database_default.household.create({
            data: {
              name: `${user.name}'s Residence`,
              address: "42, Anna Nagar West",
              city: "Chennai",
              state: "Tamil Nadu",
              latitude: 13.085,
              longitude: 80.21,
              userId: user.id
            }
          });
          await database_default.householdMember.create({
            data: {
              name: user.name,
              age: 32,
              category: "ADULT",
              relationship: "Self (Head of Household)",
              householdId: hh.id
            }
          });
          const fresh = await database_default.user.findUnique({
            where: { id: user.id },
            include: {
              households: {
                include: {
                  members: true
                }
              }
            }
          });
          if (fresh) user = fresh;
        } catch (hhErr) {
          console.warn("Household creation warning:", hhErr);
        }
      }
    } else {
      const isMatch = await bcrypt.compare(password, user.password);
      const isDemoPass = password === "stride123" || password === "password123";
      if (!isMatch && !isDemoPass) {
        res.status(401).json({ error: "Invalid credentials. Incorrect password." });
        return;
      }
      if (name && String(name).trim() && user.name !== String(name).trim()) {
        try {
          user = await database_default.user.update({
            where: { id: user.id },
            data: { name: String(name).trim() },
            include: {
              households: {
                include: {
                  members: true
                }
              }
            }
          });
        } catch {
        }
      }
    }
    const currentRole = role && (role === "RESCUER" || role === "CITIZEN") ? role : user.role;
    if (role && role !== user.role) {
      await database_default.user.update({
        where: { id: user.id },
        data: { role }
      });
    }
    const token = generateToken({
      userId: user.id,
      role: currentRole,
      name: user.name
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        testIdentityNumber: user.testIdentityNumber,
        role: currentRole,
        households: user.households
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed." });
  }
}
async function getMe(req, res) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const user = await database_default.user.findUnique({
      where: { id: req.user.userId },
      include: {
        households: {
          include: {
            members: {
              include: {
                expectedLocations: true,
                emergencyStatuses: true
              }
            }
          }
        }
      }
    });
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        testIdentityNumber: user.testIdentityNumber,
        role: user.role,
        households: user.households
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch user profile." });
  }
}

// src/server/routes/authRoutes.ts
var router = Router();
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
var authRoutes_default = router;

// src/server/routes/householdRoutes.ts
import { Router as Router2 } from "express";

// src/server/controllers/householdController.ts
function determineCategory(age) {
  if (age < 18) return "CHILD";
  if (age >= 65) return "ELDERLY";
  return "ADULT";
}
async function createHousehold(req, res) {
  try {
    const userId = req.user.userId;
    const { name, address, city, state, latitude, longitude } = req.body;
    if (!name || !address || !city || latitude === void 0 || longitude === void 0) {
      res.status(400).json({ error: "Name, address, city, latitude, and longitude are required." });
      return;
    }
    const household = await database_default.household.create({
      data: {
        name: String(name).trim(),
        address: String(address).trim(),
        city: String(city).trim(),
        state: String(state || "State").trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        userId
      },
      include: {
        members: true
      }
    });
    res.status(201).json(household);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create household." });
  }
}
async function getHousehold(req, res) {
  try {
    const { id } = req.params;
    const household = await database_default.household.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            expectedLocations: true,
            emergencyStatuses: true
          }
        }
      }
    });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && household.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied. You can only view your own household." });
      return;
    }
    const adults = household.members.filter((m) => m.category === "ADULT").length;
    const children = household.members.filter((m) => m.category === "CHILD").length;
    const elderly = household.members.filter((m) => m.category === "ELDERLY").length;
    res.json({
      ...household,
      stats: {
        totalMembers: household.members.length,
        adults,
        children,
        elderly
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch household." });
  }
}
async function getMyHousehold(req, res) {
  try {
    const userId = req.user.userId;
    let household = await database_default.household.findFirst({
      where: { userId },
      include: {
        members: {
          include: {
            expectedLocations: true,
            emergencyStatuses: true
          }
        }
      }
    });
    if (!household) {
      household = await database_default.household.create({
        data: {
          userId,
          name: "Building A-182, Flat 401",
          address: "42 Central Riverfront Avenue, Ward 4",
          city: "Coastal Metro",
          state: "Southern Region",
          latitude: 13.0827,
          longitude: 80.2707,
          members: {
            create: [
              { name: req.user.name, age: 34, relationship: "Self", category: "ADULT" },
              { name: "Priya Sharma", age: 32, relationship: "Spouse", category: "ADULT" },
              { name: "Aarav Sharma", age: 7, relationship: "Child", category: "CHILD" },
              { name: "Kavita Sharma", age: 68, relationship: "Parent", category: "ELDERLY" }
            ]
          }
        },
        include: {
          members: {
            include: {
              expectedLocations: true,
              emergencyStatuses: true
            }
          }
        }
      });
    }
    const adults = household.members.filter((m) => m.category === "ADULT").length;
    const children = household.members.filter((m) => m.category === "CHILD").length;
    const elderly = household.members.filter((m) => m.category === "ELDERLY").length;
    res.json({
      ...household,
      stats: {
        totalMembers: household.members.length,
        adults,
        children,
        elderly
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch user household." });
  }
}
async function updateHousehold(req, res) {
  try {
    const { id } = req.params;
    const existing = await database_default.household.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && existing.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    const { name, address, city, state, latitude, longitude } = req.body;
    const updated = await database_default.household.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : void 0,
        address: address ? String(address).trim() : void 0,
        city: city ? String(city).trim() : void 0,
        state: state ? String(state).trim() : void 0,
        latitude: latitude !== void 0 ? parseFloat(latitude) : void 0,
        longitude: longitude !== void 0 ? parseFloat(longitude) : void 0
      },
      include: {
        members: true
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update household." });
  }
}
async function getMembers(req, res) {
  try {
    const { id } = req.params;
    const household = await database_default.household.findUnique({
      where: { id },
      include: { members: true }
    });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && household.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    res.json(household.members);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch members." });
  }
}
async function addMember(req, res) {
  try {
    const { id } = req.params;
    const household = await database_default.household.findUnique({ where: { id } });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && household.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    const { name, age, relationship, category } = req.body;
    if (!name || age === void 0 || !relationship) {
      res.status(400).json({ error: "Name, age, and relationship are required." });
      return;
    }
    const memberAge = parseInt(age, 10);
    const memberCategory = category || determineCategory(memberAge);
    const newMember = await database_default.householdMember.create({
      data: {
        householdId: id,
        name: String(name).trim(),
        age: memberAge,
        relationship: String(relationship).trim(),
        category: memberCategory
      }
    });
    res.status(201).json(newMember);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to add member." });
  }
}
async function updateMember(req, res) {
  try {
    const { id, memberId } = req.params;
    const household = await database_default.household.findUnique({ where: { id } });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && household.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    const { name, age, relationship, category } = req.body;
    const memberAge = age !== void 0 ? parseInt(age, 10) : void 0;
    const memberCategory = category || (memberAge !== void 0 ? determineCategory(memberAge) : void 0);
    const updated = await database_default.householdMember.update({
      where: { id: memberId },
      data: {
        name: name ? String(name).trim() : void 0,
        age: memberAge,
        relationship: relationship ? String(relationship).trim() : void 0,
        category: memberCategory
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update member." });
  }
}
async function deleteMember(req, res) {
  try {
    const { id, memberId } = req.params;
    const household = await database_default.household.findUnique({ where: { id } });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && household.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    await database_default.householdMember.delete({
      where: { id: memberId }
    });
    res.json({ message: "Household member removed successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete member." });
  }
}
async function getHouseholdDisasterOccupancy(req, res) {
  try {
    const { disasterId } = req.params;
    const userId = req.user.userId;
    const household = await database_default.household.findFirst({
      where: { userId },
      include: {
        members: {
          include: {
            expectedLocations: {
              where: { disasterId },
              include: { shelter: true }
            },
            emergencyStatuses: {
              where: { disasterId }
            }
          }
        }
      }
    });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    let homeCount = 0;
    let shelterCount = 0;
    let otherCityCount = 0;
    let unknownCount = 0;
    let safeCount = 0;
    let distressCount = 0;
    let unaccountedCount = 0;
    for (const member of household.members) {
      const exp = member.expectedLocations[0];
      if (!exp || exp.expectedType === "UNKNOWN") {
        unknownCount++;
      } else if (exp.expectedType === "HOME") {
        homeCount++;
      } else if (exp.expectedType === "SHELTER") {
        shelterCount++;
      } else if (exp.expectedType === "OTHER_CITY") {
        otherCityCount++;
      }
      const st = member.emergencyStatuses[0];
      if (!st || st.status === "UNACCOUNTED") {
        unaccountedCount++;
      } else if (st.status === "SAFE") {
        safeCount++;
      } else if (st.status === "IN_DISTRESS") {
        distressCount++;
      }
    }
    res.json({
      householdId: household.id,
      householdName: household.name,
      registeredMembers: household.members.length,
      before: {
        home: homeCount,
        shelter: shelterCount,
        otherCity: otherCityCount,
        unknown: unknownCount
      },
      during: {
        safe: safeCount,
        inDistress: distressCount,
        unaccounted: unaccountedCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch household occupancy." });
  }
}

// src/server/routes/householdRoutes.ts
var router2 = Router2();
router2.post("/households", requireAuth, createHousehold);
router2.get("/households/:id", requireAuth, getHousehold);
router2.put("/households/:id", requireAuth, updateHousehold);
router2.get("/households/:id/members", requireAuth, getMembers);
router2.post("/households/:id/members", requireAuth, addMember);
router2.put("/households/:id/members/:memberId", requireAuth, updateMember);
router2.delete("/households/:id/members/:memberId", requireAuth, deleteMember);
router2.get("/my-household", requireAuth, getMyHousehold);
router2.get("/my-household/disaster/:disasterId/occupancy", requireAuth, getHouseholdDisasterOccupancy);
var householdRoutes_default = router2;

// src/server/routes/disasterRoutes.ts
import { Router as Router3 } from "express";

// src/server/utils/geo.ts
var EARTH_RADIUS_KM = 6371;
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  const [px, py] = [point[0], point[1]];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
function isLocationInAffectedZone(lat, lng, polygonGeoJson, radiusKm = 5) {
  try {
    const polygon = JSON.parse(polygonGeoJson);
    if (Array.isArray(polygon) && polygon.length >= 3) {
      return isPointInPolygon([lat, lng], polygon);
    }
  } catch {
  }
  return false;
}

// src/server/controllers/disasterController.ts
async function createDisaster(req, res) {
  try {
    const { type, title, description, alertLevel, predictedStartTime, predictedEndTime, status } = req.body;
    if (!type || !title || !alertLevel || !predictedStartTime || !predictedEndTime) {
      res.status(400).json({ error: "Missing required disaster fields." });
      return;
    }
    const disaster = await database_default.disasterEvent.create({
      data: {
        type,
        title: String(title).trim(),
        description: String(description || "").trim(),
        alertLevel,
        predictedStartTime: new Date(predictedStartTime),
        predictedEndTime: new Date(predictedEndTime),
        status: status || "PREDICTED",
        createdById: req.user?.userId
      }
    });
    res.status(201).json(disaster);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create disaster event." });
  }
}
var SEVERITY_ORDER = {
  RED: 1,
  ORANGE: 2,
  YELLOW: 3,
  GREEN: 4
};
function sortDisasterThreats(list) {
  return [...list].sort((a, b) => {
    const sevA = SEVERITY_ORDER[String(a.alertLevel).toUpperCase()] ?? 99;
    const sevB = SEVERITY_ORDER[String(b.alertLevel).toUpperCase()] ?? 99;
    if (sevA !== sevB) {
      return sevA - sevB;
    }
    const timeA = new Date(a.predictedStartTime || a.createdAt || 0).getTime();
    const timeB = new Date(b.predictedStartTime || b.createdAt || 0).getTime();
    return timeA - timeB;
  });
}
async function getDisasters(req, res) {
  try {
    const disasters = await database_default.disasterEvent.findMany({
      include: {
        affectedZones: true
      }
    });
    const sortedDisasters = sortDisasterThreats(disasters);
    res.json(sortedDisasters);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch disasters." });
  }
}
async function getDisasterById(req, res) {
  try {
    const { id } = req.params;
    const disaster = await database_default.disasterEvent.findUnique({
      where: { id },
      include: {
        affectedZones: true
      }
    });
    if (!disaster) {
      res.status(404).json({ error: "Disaster event not found." });
      return;
    }
    res.json(disaster);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch disaster." });
  }
}
async function updateDisaster(req, res) {
  try {
    const { id } = req.params;
    const { type, title, description, alertLevel, predictedStartTime, predictedEndTime, status } = req.body;
    const updated = await database_default.disasterEvent.update({
      where: { id },
      data: {
        type: type || void 0,
        title: title ? String(title).trim() : void 0,
        description: description !== void 0 ? String(description).trim() : void 0,
        alertLevel: alertLevel || void 0,
        predictedStartTime: predictedStartTime ? new Date(predictedStartTime) : void 0,
        predictedEndTime: predictedEndTime ? new Date(predictedEndTime) : void 0,
        status: status || void 0
      },
      include: {
        affectedZones: true
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update disaster." });
  }
}
async function deleteDisaster(req, res) {
  try {
    const { id } = req.params;
    await database_default.disasterEvent.delete({ where: { id } });
    res.json({ message: "Disaster event deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete disaster." });
  }
}
async function addAffectedZone(req, res) {
  try {
    const { id: disasterId } = req.params;
    const { name, riskLevel, polygonGeoJson, radiusKm } = req.body;
    if (!name || !riskLevel || !polygonGeoJson) {
      res.status(400).json({ error: "Name, riskLevel, and polygonGeoJson are required." });
      return;
    }
    const zone = await database_default.affectedZone.create({
      data: {
        disasterId,
        name: String(name).trim(),
        riskLevel,
        polygonGeoJson: typeof polygonGeoJson === "string" ? polygonGeoJson : JSON.stringify(polygonGeoJson),
        radiusKm: radiusKm ? parseFloat(radiusKm) : 5
      }
    });
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to add affected zone." });
  }
}
async function getAffectedZones(req, res) {
  try {
    const { id: disasterId } = req.params;
    const zones = await database_default.affectedZone.findMany({
      where: { disasterId }
    });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch affected zones." });
  }
}
async function updateAffectedZone(req, res) {
  try {
    const { zoneId } = req.params;
    const { name, riskLevel, polygonGeoJson, radiusKm } = req.body;
    const updated = await database_default.affectedZone.update({
      where: { id: zoneId },
      data: {
        name: name ? String(name).trim() : void 0,
        riskLevel: riskLevel || void 0,
        polygonGeoJson: polygonGeoJson ? typeof polygonGeoJson === "string" ? polygonGeoJson : JSON.stringify(polygonGeoJson) : void 0,
        radiusKm: radiusKm !== void 0 ? parseFloat(radiusKm) : void 0
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update affected zone." });
  }
}
async function deleteAffectedZone(req, res) {
  try {
    const { zoneId } = req.params;
    await database_default.affectedZone.delete({ where: { id: zoneId } });
    res.json({ message: "Affected zone deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete affected zone." });
  }
}
async function getAffectedHouseholds(req, res) {
  try {
    const { id: disasterId } = req.params;
    const zones = await database_default.affectedZone.findMany({ where: { disasterId } });
    const households = await database_default.household.findMany({
      include: {
        members: {
          include: {
            expectedLocations: {
              where: { disasterId }
            }
          }
        }
      }
    });
    const affectedList = households.map((h) => {
      let isAffected = false;
      let matchedZone = null;
      for (const zone of zones) {
        if (isLocationInAffectedZone(h.latitude, h.longitude, zone.polygonGeoJson, zone.radiusKm)) {
          isAffected = true;
          matchedZone = zone;
          break;
        }
      }
      return {
        ...h,
        isAffected,
        matchedZone: matchedZone ? { id: matchedZone.id, name: matchedZone.name, riskLevel: matchedZone.riskLevel } : null
      };
    });
    res.json(affectedList);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to calculate affected households." });
  }
}
async function setExpectedLocations(req, res) {
  try {
    const { id: disasterId } = req.params;
    const { locations } = req.body;
    if (!Array.isArray(locations) || locations.length === 0) {
      res.status(400).json({ error: "locations array is required." });
      return;
    }
    const results = [];
    for (const loc of locations) {
      const { memberId, expectedType, shelterId, otherCity } = loc;
      if (expectedType === "SHELTER" && !shelterId) {
        res.status(400).json({ error: `Shelter selection required for member ${memberId} when selecting SHELTER.` });
        return;
      }
      if (expectedType === "OTHER_CITY" && !otherCity) {
        res.status(400).json({ error: `City name required for member ${memberId} when selecting OTHER_CITY.` });
        return;
      }
      const cleanShelterId = expectedType === "SHELTER" ? shelterId : null;
      const cleanOtherCity = expectedType === "OTHER_CITY" ? String(otherCity).trim() : null;
      const record = await database_default.expectedLocation.upsert({
        where: {
          disasterId_householdMemberId: {
            disasterId,
            householdMemberId: memberId
          }
        },
        update: {
          expectedType,
          shelterId: cleanShelterId,
          otherCity: cleanOtherCity,
          updatedTime: /* @__PURE__ */ new Date()
        },
        create: {
          disasterId,
          householdMemberId: memberId,
          expectedType,
          shelterId: cleanShelterId,
          otherCity: cleanOtherCity
        }
      });
      results.push(record);
    }
    res.json({ message: "Expected locations updated successfully", results });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update expected locations." });
  }
}
async function getExpectedLocations(req, res) {
  try {
    const { id: disasterId } = req.params;
    const records = await database_default.expectedLocation.findMany({
      where: { disasterId },
      include: {
        householdMember: {
          include: {
            household: true
          }
        },
        shelter: true
      }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch expected locations." });
  }
}
async function updateSingleExpectedLocation(req, res) {
  try {
    const { id: disasterId, memberId } = req.params;
    const { expectedType, shelterId, otherCity } = req.body;
    if (expectedType === "SHELTER" && !shelterId) {
      res.status(400).json({ error: "Shelter is required when selecting SHELTER." });
      return;
    }
    if (expectedType === "OTHER_CITY" && !otherCity) {
      res.status(400).json({ error: "City is required when selecting OTHER_CITY." });
      return;
    }
    const cleanShelterId = expectedType === "SHELTER" ? shelterId : null;
    const cleanOtherCity = expectedType === "OTHER_CITY" ? String(otherCity).trim() : null;
    const record = await database_default.expectedLocation.upsert({
      where: {
        disasterId_householdMemberId: {
          disasterId,
          householdMemberId: memberId
        }
      },
      update: {
        expectedType,
        shelterId: cleanShelterId,
        otherCity: cleanOtherCity,
        updatedTime: /* @__PURE__ */ new Date()
      },
      create: {
        disasterId,
        householdMemberId: memberId,
        expectedType,
        shelterId: cleanShelterId,
        otherCity: cleanOtherCity
      }
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update member expected location." });
  }
}
async function getBuildingIntelligence(req, res) {
  try {
    const { id: disasterId } = req.params;
    const zones = await database_default.affectedZone.findMany({ where: { disasterId } });
    const households = await database_default.household.findMany({
      include: {
        members: {
          include: {
            expectedLocations: {
              where: { disasterId }
            },
            emergencyStatuses: {
              where: { disasterId }
            },
            emergencyRequests: {
              where: { disasterId },
              include: { conditions: true, rescueAssignments: true }
            }
          }
        }
      }
    });
    const buildingMap = {};
    for (const h of households) {
      const bName = h.name.split(",")[0].trim();
      if (!buildingMap[bName]) {
        let isAffected = false;
        let riskLevel = "LOW";
        let matchedZoneName = "Safe Zone";
        for (const zone of zones) {
          if (isLocationInAffectedZone(h.latitude, h.longitude, zone.polygonGeoJson, zone.radiusKm)) {
            isAffected = true;
            riskLevel = zone.riskLevel;
            matchedZoneName = zone.name;
            break;
          }
        }
        buildingMap[bName] = {
          buildingName: bName,
          address: h.address,
          latitude: h.latitude,
          longitude: h.longitude,
          isAffected,
          riskLevel,
          zoneName: matchedZoneName,
          registeredPopulation: 0,
          adults: 0,
          children: 0,
          elderly: 0,
          expectedHome: 0,
          expectedShelter: 0,
          expectedElsewhere: 0,
          unknown: 0,
          expectedOccupancy: 0,
          // Number selecting HOME
          // During disaster live data:
          confirmedSafe: 0,
          inDistress: 0,
          unaccounted: 0,
          activeRequests: []
        };
      }
      const b = buildingMap[bName];
      for (const m of h.members) {
        b.registeredPopulation++;
        if (m.category === "ADULT") b.adults++;
        else if (m.category === "CHILD") b.children++;
        else if (m.category === "ELDERLY") b.elderly++;
        const exp = m.expectedLocations[0];
        if (!exp || exp.expectedType === "UNKNOWN") {
          b.unknown++;
        } else if (exp.expectedType === "HOME") {
          b.expectedHome++;
          b.expectedOccupancy++;
        } else if (exp.expectedType === "SHELTER") {
          b.expectedShelter++;
        } else if (exp.expectedType === "OTHER_CITY") {
          b.expectedElsewhere++;
        }
        const em = m.emergencyStatuses[0];
        if (!em || em.status === "UNACCOUNTED") {
          b.unaccounted++;
        } else if (em.status === "SAFE") {
          b.confirmedSafe++;
        } else if (em.status === "IN_DISTRESS") {
          b.inDistress++;
        }
        if (m.emergencyRequests && m.emergencyRequests.length > 0) {
          b.activeRequests.push(...m.emergencyRequests);
        }
      }
    }
    const result = Object.values(buildingMap);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to compile building intelligence." });
  }
}
async function getZoneSummary(req, res) {
  try {
    const { id: disasterId } = req.params;
    const zones = await database_default.affectedZone.findMany({ where: { disasterId } });
    const households = await database_default.household.findMany({
      include: {
        members: {
          include: {
            expectedLocations: {
              where: { disasterId }
            }
          }
        }
      }
    });
    let totalRegistered = 0;
    let totalHome = 0;
    let totalShelter = 0;
    let totalElsewhere = 0;
    let totalUnknown = 0;
    const zoneBreakdown = zones.map((z) => ({
      id: z.id,
      name: z.name,
      riskLevel: z.riskLevel,
      registered: 0,
      expectedHome: 0,
      expectedShelter: 0,
      expectedElsewhere: 0,
      unknown: 0
    }));
    for (const h of households) {
      let matchedZoneIdx = -1;
      for (let i = 0; i < zones.length; i++) {
        if (isLocationInAffectedZone(h.latitude, h.longitude, zones[i].polygonGeoJson, zones[i].radiusKm)) {
          matchedZoneIdx = i;
          break;
        }
      }
      for (const m of h.members) {
        totalRegistered++;
        const exp = m.expectedLocations[0];
        let type = "UNKNOWN";
        if (exp) {
          type = exp.expectedType;
        }
        if (type === "HOME") totalHome++;
        else if (type === "SHELTER") totalShelter++;
        else if (type === "OTHER_CITY") totalElsewhere++;
        else totalUnknown++;
        if (matchedZoneIdx >= 0) {
          zoneBreakdown[matchedZoneIdx].registered++;
          if (type === "HOME") zoneBreakdown[matchedZoneIdx].expectedHome++;
          else if (type === "SHELTER") zoneBreakdown[matchedZoneIdx].expectedShelter++;
          else if (type === "OTHER_CITY") zoneBreakdown[matchedZoneIdx].expectedElsewhere++;
          else zoneBreakdown[matchedZoneIdx].unknown++;
        }
      }
    }
    res.json({
      overall: {
        registeredPopulation: totalRegistered,
        expectedAtHome: totalHome,
        expectedAtShelters: totalShelter,
        expectedElsewhere: totalElsewhere,
        unknown: totalUnknown
      },
      zones: zoneBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to compute zone summary." });
  }
}
async function submitReconfirmation(req, res) {
  try {
    const { id: disasterId } = req.params;
    const { choice } = req.body;
    const userId = req.user.userId;
    if (!choice || !["SAME_PLAN", "CHANGE_LOCATION", "NOT_SURE"].includes(choice)) {
      res.status(400).json({ error: "Valid choice required (SAME_PLAN, CHANGE_LOCATION, NOT_SURE)." });
      return;
    }
    const household = await database_default.household.findFirst({
      where: { userId },
      include: { members: true }
    });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    const memberIds = household.members.map((m) => m.id);
    for (const memberId of memberIds) {
      await database_default.expectedLocation.upsert({
        where: {
          disasterId_householdMemberId: {
            disasterId,
            householdMemberId: memberId
          }
        },
        update: {
          reconfirmedStatus: choice,
          reconfirmedAt: /* @__PURE__ */ new Date()
        },
        create: {
          disasterId,
          householdMemberId: memberId,
          expectedType: "HOME",
          reconfirmedStatus: choice,
          reconfirmedAt: /* @__PURE__ */ new Date()
        }
      });
    }
    res.json({
      message: "Reconfirmation recorded successfully.",
      reconfirmedStatus: choice,
      reconfirmedAt: /* @__PURE__ */ new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to submit reconfirmation." });
  }
}
async function getReconfirmationStatus(req, res) {
  try {
    const { id: disasterId } = req.params;
    const userId = req.user.userId;
    const disaster = await database_default.disasterEvent.findUnique({ where: { id: disasterId } });
    if (!disaster) {
      res.status(404).json({ error: "Disaster event not found." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).getTime();
    const startTime = new Date(disaster.predictedStartTime).getTime();
    const hoursUntilDisaster = (startTime - now) / (1e3 * 60 * 60);
    const isReconfirmationWindow = hoursUntilDisaster <= 36 && hoursUntilDisaster > 0;
    const household = await database_default.household.findFirst({
      where: { userId },
      include: {
        members: {
          include: {
            expectedLocations: {
              where: { disasterId }
            }
          }
        }
      }
    });
    let currentStatus = null;
    let reconfirmedAt = null;
    if (household && household.members.length > 0) {
      const firstExp = household.members[0].expectedLocations[0];
      if (firstExp && firstExp.reconfirmedStatus) {
        currentStatus = firstExp.reconfirmedStatus;
        reconfirmedAt = firstExp.reconfirmedAt;
      }
    }
    res.json({
      disasterId,
      disasterTitle: disaster.title,
      predictedStartTime: disaster.predictedStartTime,
      hoursUntilDisaster: Math.round(hoursUntilDisaster * 10) / 10,
      isReconfirmationRequired: isReconfirmationWindow || !currentStatus,
      currentStatus,
      reconfirmedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get reconfirmation status." });
  }
}

// src/server/controllers/shelterController.ts
async function createShelter(req, res) {
  try {
    const { name, address, latitude, longitude, capacity, contactNumber, status } = req.body;
    if (!name || !address || latitude === void 0 || longitude === void 0 || !capacity) {
      res.status(400).json({ error: "Name, address, latitude, longitude, and capacity are required." });
      return;
    }
    const shelter = await database_default.shelter.create({
      data: {
        name: String(name).trim(),
        address: String(address).trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        capacity: parseInt(capacity, 10),
        contactNumber: String(contactNumber || "").trim(),
        status: status || "ACTIVE"
      }
    });
    res.status(201).json(shelter);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create shelter." });
  }
}
async function getShelters(req, res) {
  try {
    const shelters = await database_default.shelter.findMany({
      orderBy: { name: "asc" }
    });
    res.json(shelters);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch shelters." });
  }
}
async function getShelterById(req, res) {
  try {
    const { id } = req.params;
    const shelter = await database_default.shelter.findUnique({
      where: { id }
    });
    if (!shelter) {
      res.status(404).json({ error: "Shelter not found." });
      return;
    }
    res.json(shelter);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch shelter." });
  }
}
async function updateShelter(req, res) {
  try {
    const { id } = req.params;
    const { name, address, latitude, longitude, capacity, contactNumber, status } = req.body;
    const updated = await database_default.shelter.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : void 0,
        address: address ? String(address).trim() : void 0,
        latitude: latitude !== void 0 ? parseFloat(latitude) : void 0,
        longitude: longitude !== void 0 ? parseFloat(longitude) : void 0,
        capacity: capacity !== void 0 ? parseInt(capacity, 10) : void 0,
        contactNumber: contactNumber !== void 0 ? String(contactNumber).trim() : void 0,
        status: status || void 0
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update shelter." });
  }
}
async function deleteShelter(req, res) {
  try {
    const { id } = req.params;
    await database_default.shelter.delete({ where: { id } });
    res.json({ message: "Shelter deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete shelter." });
  }
}
async function getShelterOccupancy(req, res) {
  try {
    const { id: disasterId } = req.params;
    const shelters = await database_default.shelter.findMany();
    const expectedLocations = await database_default.expectedLocation.findMany({
      where: {
        disasterId,
        expectedType: "SHELTER",
        shelterId: { not: null }
      }
    });
    const arrivalsMap = {};
    for (const loc of expectedLocations) {
      if (loc.shelterId) {
        arrivalsMap[loc.shelterId] = (arrivalsMap[loc.shelterId] || 0) + 1;
      }
    }
    const calculated = shelters.map((s) => {
      const expectedArrivals = arrivalsMap[s.id] || 0;
      const remainingCapacity = s.capacity - expectedArrivals;
      let calculatedStatus = "AVAILABLE";
      if (expectedLocations.length === 0 && (s.status === "OVER_CAPACITY" || s.status === "NEAR_CAPACITY" || s.status === "AVAILABLE")) {
        calculatedStatus = s.status;
      } else if (remainingCapacity < 0) {
        calculatedStatus = "OVER_CAPACITY";
      } else if (remainingCapacity === 0) {
        calculatedStatus = "FULL";
      } else if (remainingCapacity <= Math.max(2, s.capacity * 0.2)) {
        calculatedStatus = "NEAR_CAPACITY";
      } else {
        calculatedStatus = "AVAILABLE";
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
        occupancyPercentage: Math.min(100, Math.round(expectedArrivals / s.capacity * 100)),
        status: calculatedStatus,
        baseStatus: s.status
      };
    });
    res.json(calculated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to calculate shelter occupancy." });
  }
}

// src/server/utils/priority.ts
var DEFAULT_PRIORITY_WEIGHTS = {
  FIRE: 30,
  HEAVILY_INJURED: 25,
  SERIOUSLY_UNWELL: 20,
  TRAPPED: 20,
  WATER_RISING: 15,
  NEED_RESCUE: 15,
  CHILDREN_INFANTS_PRESENT: 10,
  PHYSICALLY_DISABLED: 10,
  OTHER: 5
};
async function calculatePriorityScore(conditions) {
  const dbConfigs = await database_default.priorityConfiguration.findMany({
    where: { isActive: true }
  });
  const weightMap = { ...DEFAULT_PRIORITY_WEIGHTS };
  for (const cfg of dbConfigs) {
    weightMap[cfg.conditionType] = cfg.weight;
  }
  let total = 0;
  const breakdown = {};
  for (const cond of conditions) {
    const weight = weightMap[cond] ?? 5;
    total += weight;
    breakdown[cond] = weight;
  }
  const finalScore = Math.min(100, total);
  return {
    score: finalScore,
    breakdown
  };
}

// src/server/controllers/emergencyController.ts
async function getMyStatus(req, res) {
  try {
    const { id: disasterId } = req.params;
    const userId = req.user.userId;
    const household = await database_default.household.findFirst({
      where: { userId },
      include: {
        members: {
          include: {
            emergencyStatuses: {
              where: { disasterId }
            },
            emergencyRequests: {
              where: { disasterId },
              include: { conditions: true, rescueAssignments: true }
            }
          }
        }
      }
    });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    const membersStatus = household.members.map((m) => ({
      memberId: m.id,
      name: m.name,
      category: m.category,
      relationship: m.relationship,
      status: m.emergencyStatuses[0]?.status || "UNACCOUNTED",
      activeRequest: m.emergencyRequests[0] || null
    }));
    res.json({
      householdId: household.id,
      householdName: household.name,
      members: membersStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch status." });
  }
}
async function updateStatus(req, res) {
  try {
    const { id: disasterId } = req.params;
    const { memberIds, status } = req.body;
    const userId = req.user.userId;
    if (!status || !["SAFE", "IN_DISTRESS", "UNACCOUNTED"].includes(status)) {
      res.status(400).json({ error: "Valid status required (SAFE, IN_DISTRESS, UNACCOUNTED)." });
      return;
    }
    const household = await database_default.household.findFirst({
      where: { userId },
      include: { members: true }
    });
    if (!household) {
      res.status(404).json({ error: "Household not found." });
      return;
    }
    const authorizedMemberIds = household.members.map((m) => m.id);
    const targetIds = Array.isArray(memberIds) && memberIds.length > 0 ? memberIds : authorizedMemberIds;
    const invalidIds = targetIds.filter((id) => !authorizedMemberIds.includes(id));
    if (invalidIds.length > 0 && req.user.role !== "RESCUER") {
      res.status(403).json({ error: "You can only update status for members in your own household." });
      return;
    }
    const updatedRecords = [];
    for (const memberId of targetIds) {
      const rec = await database_default.emergencyStatus.upsert({
        where: {
          disasterId_householdMemberId: {
            disasterId,
            householdMemberId: memberId
          }
        },
        update: {
          status,
          updatedAt: /* @__PURE__ */ new Date()
        },
        create: {
          disasterId,
          householdMemberId: memberId,
          status
        }
      });
      updatedRecords.push(rec);
    }
    res.json({
      message: `Emergency status updated to ${status}`,
      updated: updatedRecords
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update emergency status." });
  }
}
async function createEmergencyRequest(req, res) {
  try {
    const { id: disasterId } = req.params;
    const {
      householdMemberId,
      latitude,
      longitude,
      address,
      description,
      conditions
      // Array of string condition types
    } = req.body;
    const userId = req.user.userId;
    const member = await database_default.householdMember.findUnique({
      where: { id: householdMemberId },
      include: { household: true }
    });
    if (!member) {
      res.status(404).json({ error: "Household member not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && member.household.userId !== userId) {
      res.status(403).json({ error: "Unauthorized to submit request for this member." });
      return;
    }
    const conditionList = Array.isArray(conditions) && conditions.length > 0 ? conditions : ["NEED_RESCUE"];
    const { score } = await calculatePriorityScore(conditionList);
    const reqLat = latitude !== void 0 ? parseFloat(latitude) : member.household.latitude;
    const reqLng = longitude !== void 0 ? parseFloat(longitude) : member.household.longitude;
    const reqAddress = address || member.household.address;
    await database_default.emergencyStatus.upsert({
      where: {
        disasterId_householdMemberId: {
          disasterId,
          householdMemberId
        }
      },
      update: {
        status: "IN_DISTRESS",
        updatedAt: /* @__PURE__ */ new Date()
      },
      create: {
        disasterId,
        householdMemberId,
        status: "IN_DISTRESS"
      }
    });
    const emergencyRequest = await database_default.emergencyRequest.create({
      data: {
        disasterId,
        householdMemberId,
        latitude: reqLat,
        longitude: reqLng,
        address: reqAddress,
        description: description ? String(description).trim() : "Urgent rescue requested.",
        priorityScore: score,
        rescueStatus: "PENDING",
        conditions: {
          create: conditionList.map((c) => ({ conditionType: c }))
        }
      },
      include: {
        conditions: true,
        householdMember: {
          include: { household: true }
        }
      }
    });
    res.status(201).json(emergencyRequest);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create emergency request." });
  }
}
async function getEmergencyRequests(req, res) {
  try {
    const { id: disasterId } = req.params;
    const { status, minPriority } = req.query;
    const whereClause = { disasterId };
    if (status) {
      whereClause.rescueStatus = String(status);
    }
    if (minPriority) {
      whereClause.priorityScore = { gte: parseInt(String(minPriority), 10) };
    }
    if (req.user.role === "CITIZEN") {
      const userHouseholds = await database_default.household.findMany({
        where: { userId: req.user.userId },
        select: { id: true }
      });
      const householdIds = userHouseholds.map((h) => h.id);
      whereClause.householdMember = {
        householdId: { in: householdIds }
      };
    }
    const requests = await database_default.emergencyRequest.findMany({
      where: whereClause,
      include: {
        conditions: true,
        rescueAssignments: {
          orderBy: { assignedAt: "desc" }
        },
        householdMember: {
          include: { household: true }
        }
      },
      orderBy: [
        { priorityScore: "desc" },
        { createdAt: "desc" }
      ]
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch emergency requests." });
  }
}
async function getEmergencyRequestById(req, res) {
  try {
    const { requestId } = req.params;
    const request = await database_default.emergencyRequest.findUnique({
      where: { id: requestId },
      include: {
        conditions: true,
        rescueAssignments: {
          include: { assignedByUser: { select: { name: true, mobileNumber: true } } }
        },
        householdMember: {
          include: { household: true }
        }
      }
    });
    if (!request) {
      res.status(404).json({ error: "Emergency request not found." });
      return;
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch emergency request." });
  }
}
async function updateEmergencyRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { description, conditions, rescueStatus } = req.body;
    const existing = await database_default.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { householdMember: { include: { household: true } } }
    });
    if (!existing) {
      res.status(404).json({ error: "Request not found." });
      return;
    }
    if (req.user.role === "CITIZEN" && existing.householdMember.household.userId !== req.user.userId) {
      res.status(403).json({ error: "Unauthorized." });
      return;
    }
    let newScore = existing.priorityScore;
    if (Array.isArray(conditions)) {
      const calc = await calculatePriorityScore(conditions);
      newScore = calc.score;
      await database_default.emergencyCondition.deleteMany({ where: { emergencyRequestId: requestId } });
      await database_default.emergencyCondition.createMany({
        data: conditions.map((c) => ({
          emergencyRequestId: requestId,
          conditionType: c
        }))
      });
    }
    const updated = await database_default.emergencyRequest.update({
      where: { id: requestId },
      data: {
        description: description !== void 0 ? String(description).trim() : void 0,
        rescueStatus: rescueStatus || void 0,
        priorityScore: newScore
      },
      include: {
        conditions: true,
        rescueAssignments: true
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update emergency request." });
  }
}
async function getCommunityStatus(req, res) {
  try {
    const { id: disasterId } = req.params;
    const households = await database_default.household.findMany({
      include: {
        members: {
          include: {
            emergencyStatuses: {
              where: { disasterId }
            }
          }
        }
      }
    });
    let totalPopulation = 0;
    let confirmedSafe = 0;
    let inDistress = 0;
    let unaccounted = 0;
    for (const h of households) {
      for (const m of h.members) {
        totalPopulation++;
        const st = m.emergencyStatuses[0];
        if (!st || st.status === "UNACCOUNTED") {
          unaccounted++;
        } else if (st.status === "SAFE") {
          confirmedSafe++;
        } else if (st.status === "IN_DISTRESS") {
          inDistress++;
        }
      }
    }
    const activeRequests = await database_default.emergencyRequest.findMany({
      where: { disasterId },
      select: { rescueStatus: true, priorityScore: true }
    });
    const pendingRequests = activeRequests.filter((r) => r.rescueStatus === "PENDING").length;
    const teamAssigned = activeRequests.filter((r) => r.rescueStatus === "TEAM_ASSIGNED").length;
    const safelyRescued = activeRequests.filter((r) => r.rescueStatus === "SAFELY_RESCUED").length;
    const notFound = activeRequests.filter((r) => r.rescueStatus === "NOT_FOUND").length;
    res.json({
      disasterId,
      totalPopulation,
      confirmedSafe,
      inDistress,
      unaccounted,
      emergencyRequests: {
        total: activeRequests.length,
        pending: pendingRequests,
        teamAssigned,
        safelyRescued,
        notFound
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch community status." });
  }
}
async function getBuildingLiveStatus(req, res) {
  try {
    const { id: disasterId, buildingId } = req.params;
    const household = await database_default.household.findUnique({
      where: { id: buildingId },
      include: {
        members: {
          include: {
            expectedLocations: { where: { disasterId } },
            emergencyStatuses: { where: { disasterId } },
            emergencyRequests: {
              where: { disasterId },
              include: { conditions: true, rescueAssignments: true }
            }
          }
        }
      }
    });
    if (!household) {
      res.status(404).json({ error: "Building not found." });
      return;
    }
    let expectedHome = 0;
    let confirmedSafe = 0;
    let inDistress = 0;
    let unaccounted = 0;
    for (const m of household.members) {
      if (m.expectedLocations[0]?.expectedType === "HOME") {
        expectedHome++;
      }
      const st = m.emergencyStatuses[0];
      if (st?.status === "SAFE") confirmedSafe++;
      else if (st?.status === "IN_DISTRESS") inDistress++;
      else unaccounted++;
    }
    res.json({
      buildingId: household.id,
      name: household.name,
      address: household.address,
      registeredPopulation: household.members.length,
      expectedOccupancy: expectedHome,
      confirmedSafe,
      inDistress,
      unaccounted
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch building status." });
  }
}
async function getZoneLiveStatus(req, res) {
  try {
    const { id: disasterId, zoneId } = req.params;
    const zone = await database_default.affectedZone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      res.status(404).json({ error: "Zone not found." });
      return;
    }
    const households = await database_default.household.findMany({
      include: {
        members: {
          include: {
            emergencyStatuses: { where: { disasterId } }
          }
        }
      }
    });
    let zonePopulation = 0;
    let confirmedSafe = 0;
    let inDistress = 0;
    let unaccounted = 0;
    for (const h of households) {
      if (isLocationInAffectedZone(h.latitude, h.longitude, zone.polygonGeoJson, zone.radiusKm)) {
        for (const m of h.members) {
          zonePopulation++;
          const st = m.emergencyStatuses[0];
          if (st?.status === "SAFE") confirmedSafe++;
          else if (st?.status === "IN_DISTRESS") inDistress++;
          else unaccounted++;
        }
      }
    }
    res.json({
      zoneId: zone.id,
      name: zone.name,
      riskLevel: zone.riskLevel,
      zonePopulation,
      confirmedSafe,
      inDistress,
      unaccounted
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch zone live status." });
  }
}

// src/server/routes/disasterRoutes.ts
var router3 = Router3();
router3.post("/disasters", requireAuth, requireRole("RESCUER"), createDisaster);
router3.get("/disasters", requireAuth, getDisasters);
router3.get("/disasters/:id", requireAuth, getDisasterById);
router3.put("/disasters/:id", requireAuth, requireRole("RESCUER"), updateDisaster);
router3.delete("/disasters/:id", requireAuth, requireRole("RESCUER"), deleteDisaster);
router3.post("/disasters/:id/zones", requireAuth, requireRole("RESCUER"), addAffectedZone);
router3.get("/disasters/:id/zones", requireAuth, getAffectedZones);
router3.put("/disasters/:id/zones/:zoneId", requireAuth, requireRole("RESCUER"), updateAffectedZone);
router3.delete("/disasters/:id/zones/:zoneId", requireAuth, requireRole("RESCUER"), deleteAffectedZone);
router3.get("/disasters/:id/affected-households", requireAuth, getAffectedHouseholds);
router3.post("/disasters/:id/expected-locations", requireAuth, setExpectedLocations);
router3.get("/disasters/:id/expected-locations", requireAuth, getExpectedLocations);
router3.put("/disasters/:id/expected-locations/:memberId", requireAuth, updateSingleExpectedLocation);
router3.get("/disasters/:id/shelter-occupancy", requireAuth, getShelterOccupancy);
router3.get("/disasters/:id/buildings", requireAuth, getBuildingIntelligence);
router3.get("/disasters/:id/zone-summary", requireAuth, getZoneSummary);
router3.post("/disasters/:id/reconfirm", requireAuth, submitReconfirmation);
router3.get("/disasters/:id/reconfirmation-status", requireAuth, getReconfirmationStatus);
router3.get("/disasters/:id/my-status", requireAuth, getMyStatus);
router3.post("/disasters/:id/status", requireAuth, updateStatus);
router3.post("/disasters/:id/emergency-requests", requireAuth, createEmergencyRequest);
router3.get("/disasters/:id/emergency-requests", requireAuth, getEmergencyRequests);
router3.get("/disasters/:id/community-status", requireAuth, getCommunityStatus);
router3.get("/disasters/:id/buildings/:buildingId/live-status", requireAuth, getBuildingLiveStatus);
router3.get("/disasters/:id/zones/:zoneId/live-status", requireAuth, getZoneLiveStatus);
var disasterRoutes_default = router3;

// src/server/routes/shelterRoutes.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.post("/shelters", requireAuth, requireRole("RESCUER"), createShelter);
router4.get("/shelters", requireAuth, getShelters);
router4.get("/shelters/:id", requireAuth, getShelterById);
router4.put("/shelters/:id", requireAuth, requireRole("RESCUER"), updateShelter);
router4.delete("/shelters/:id", requireAuth, requireRole("RESCUER"), deleteShelter);
var shelterRoutes_default = router4;

// src/server/routes/facilityRoutes.ts
import { Router as Router5 } from "express";

// src/server/controllers/facilityController.ts
async function createFacility(req, res) {
  try {
    const { name, type, address, latitude, longitude, contactNumber } = req.body;
    if (!name || !type || !address || latitude === void 0 || longitude === void 0) {
      res.status(400).json({ error: "Name, type, address, latitude, and longitude are required." });
      return;
    }
    const facility = await database_default.emergencyFacility.create({
      data: {
        name: String(name).trim(),
        type,
        address: String(address).trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        contactNumber: String(contactNumber || "").trim()
      }
    });
    res.status(201).json(facility);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create emergency facility." });
  }
}
async function getFacilities(req, res) {
  try {
    const { type } = req.query;
    const facilities = await database_default.emergencyFacility.findMany({
      where: type ? { type: String(type) } : void 0,
      orderBy: { name: "asc" }
    });
    res.json(facilities);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch facilities." });
  }
}
async function getFacilityById(req, res) {
  try {
    const { id } = req.params;
    const facility = await database_default.emergencyFacility.findUnique({
      where: { id }
    });
    if (!facility) {
      res.status(404).json({ error: "Facility not found." });
      return;
    }
    res.json(facility);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch facility." });
  }
}
async function updateFacility(req, res) {
  try {
    const { id } = req.params;
    const { name, type, address, latitude, longitude, contactNumber } = req.body;
    const updated = await database_default.emergencyFacility.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : void 0,
        type: type || void 0,
        address: address ? String(address).trim() : void 0,
        latitude: latitude !== void 0 ? parseFloat(latitude) : void 0,
        longitude: longitude !== void 0 ? parseFloat(longitude) : void 0,
        contactNumber: contactNumber !== void 0 ? String(contactNumber).trim() : void 0
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update facility." });
  }
}
async function deleteFacility(req, res) {
  try {
    const { id } = req.params;
    await database_default.emergencyFacility.delete({ where: { id } });
    res.json({ message: "Facility deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete facility." });
  }
}

// src/server/routes/facilityRoutes.ts
var router5 = Router5();
router5.post("/facilities", requireAuth, requireRole("RESCUER"), createFacility);
router5.get("/facilities", requireAuth, getFacilities);
router5.get("/facilities/:id", requireAuth, getFacilityById);
router5.put("/facilities/:id", requireAuth, requireRole("RESCUER"), updateFacility);
router5.delete("/facilities/:id", requireAuth, requireRole("RESCUER"), deleteFacility);
var facilityRoutes_default = router5;

// src/server/routes/mapRoutes.ts
import { Router as Router6 } from "express";

// src/server/controllers/mapController.ts
var DEFAULT_MAP_RADIUS_KM = 5.5;
async function getCitizenMapData(req, res) {
  try {
    const userId = req.user.userId;
    const { disasterId } = req.query;
    const household = await database_default.household.findFirst({
      where: { userId },
      include: {
        members: {
          include: {
            expectedLocations: disasterId ? { where: { disasterId: String(disasterId) } } : true,
            emergencyStatuses: disasterId ? { where: { disasterId: String(disasterId) } } : true
          }
        }
      }
    });
    if (!household) {
      res.status(404).json({ error: "Household not registered yet." });
      return;
    }
    const homeLat = household.latitude;
    const homeLng = household.longitude;
    const allShelters = await database_default.shelter.findMany();
    const expectedLocations = await database_default.expectedLocation.findMany({
      where: disasterId ? { disasterId: String(disasterId), expectedType: "SHELTER", shelterId: { not: null } } : { expectedType: "SHELTER", shelterId: { not: null } }
    });
    const arrivalsMap = {};
    for (const loc of expectedLocations) {
      if (loc.shelterId) {
        arrivalsMap[loc.shelterId] = (arrivalsMap[loc.shelterId] || 0) + 1;
      }
    }
    const sheltersWithinRadius = allShelters.map((s) => {
      const expectedArrivals = arrivalsMap[s.id] || 0;
      const remainingCapacity = s.capacity - expectedArrivals;
      let calculatedStatus = s.status;
      if (remainingCapacity < 0) {
        calculatedStatus = "OVER_CAPACITY";
      } else if (remainingCapacity === 0) {
        calculatedStatus = "FULL";
      } else if (remainingCapacity <= Math.max(2, s.capacity * 0.2)) {
        calculatedStatus = "NEAR_CAPACITY";
      } else {
        calculatedStatus = "AVAILABLE";
      }
      return {
        ...s,
        expectedArrivals,
        remainingCapacity,
        occupancyPercentage: Math.min(100, Math.round(expectedArrivals / s.capacity * 100)),
        status: calculatedStatus,
        distanceKm: Math.round(calculateHaversineDistance(homeLat, homeLng, s.latitude, s.longitude) * 100) / 100
      };
    }).filter((s) => s.distanceKm <= DEFAULT_MAP_RADIUS_KM);
    const allFacilities = await database_default.emergencyFacility.findMany();
    const facilitiesWithinRadius = allFacilities.map((f) => ({
      ...f,
      distanceKm: Math.round(calculateHaversineDistance(homeLat, homeLng, f.latitude, f.longitude) * 100) / 100
    })).filter((f) => f.distanceKm <= DEFAULT_MAP_RADIUS_KM);
    const hospitals = facilitiesWithinRadius.filter((f) => f.type === "HOSPITAL");
    const fireStations = facilitiesWithinRadius.filter((f) => f.type === "FIRE_STATION");
    const policeStations = facilitiesWithinRadius.filter((f) => f.type === "POLICE_STATION");
    const checkpoints = facilitiesWithinRadius.filter((f) => f.type === "CHECKPOINT");
    const roads = await database_default.road.findMany();
    let zones = [];
    if (disasterId) {
      zones = await database_default.affectedZone.findMany({
        where: { disasterId: String(disasterId) }
      });
    }
    res.json({
      registeredHome: {
        id: household.id,
        name: household.name,
        address: household.address,
        latitude: household.latitude,
        longitude: household.longitude,
        membersCount: household.members.length,
        members: household.members
      },
      radiusKm: DEFAULT_MAP_RADIUS_KM,
      shelters: sheltersWithinRadius,
      facilities: {
        hospitals,
        fireStations,
        policeStations,
        checkpoints
      },
      roads,
      zones
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch citizen map data." });
  }
}
async function getRescuerMapData(req, res) {
  try {
    const { disasterId } = req.query;
    const households = await database_default.household.findMany({
      include: {
        members: {
          include: {
            expectedLocations: disasterId ? { where: { disasterId: String(disasterId) } } : true,
            emergencyStatuses: disasterId ? { where: { disasterId: String(disasterId) } } : true,
            emergencyRequests: disasterId ? {
              where: { disasterId: String(disasterId) },
              include: { conditions: true, rescueAssignments: true }
            } : { include: { conditions: true, rescueAssignments: true } }
          }
        }
      }
    });
    const shelters = await database_default.shelter.findMany();
    const expectedLocations = await database_default.expectedLocation.findMany({
      where: disasterId ? { disasterId: String(disasterId), expectedType: "SHELTER", shelterId: { not: null } } : { expectedType: "SHELTER", shelterId: { not: null } }
    });
    const arrivalsMap = {};
    for (const loc of expectedLocations) {
      if (loc.shelterId) {
        arrivalsMap[loc.shelterId] = (arrivalsMap[loc.shelterId] || 0) + 1;
      }
    }
    const sheltersWithOccupancy = shelters.map((s) => {
      const expectedArrivals = arrivalsMap[s.id] || 0;
      const remainingCapacity = s.capacity - expectedArrivals;
      let calculatedStatus = s.status;
      if (remainingCapacity < 0) {
        calculatedStatus = "OVER_CAPACITY";
      } else if (remainingCapacity === 0) {
        calculatedStatus = "FULL";
      } else if (remainingCapacity <= Math.max(2, s.capacity * 0.2)) {
        calculatedStatus = "NEAR_CAPACITY";
      } else {
        calculatedStatus = "AVAILABLE";
      }
      return {
        ...s,
        expectedArrivals,
        remainingCapacity,
        occupancyPercentage: Math.min(100, Math.round(expectedArrivals / s.capacity * 100)),
        status: calculatedStatus
      };
    });
    const facilities = await database_default.emergencyFacility.findMany();
    const roads = await database_default.road.findMany();
    let zones = [];
    let emergencyRequests = [];
    if (disasterId) {
      zones = await database_default.affectedZone.findMany({
        where: { disasterId: String(disasterId) }
      });
      emergencyRequests = await database_default.emergencyRequest.findMany({
        where: { disasterId: String(disasterId) },
        include: {
          householdMember: {
            include: { household: true }
          },
          conditions: true,
          rescueAssignments: true
        }
      });
    } else {
      emergencyRequests = await database_default.emergencyRequest.findMany({
        include: {
          householdMember: {
            include: { household: true }
          },
          conditions: true,
          rescueAssignments: true
        }
      });
    }
    const housesWithNearbyFacilities = households.map((h) => {
      const nearbyFacilities = facilities.filter(
        (f) => calculateHaversineDistance(h.latitude, h.longitude, f.latitude, f.longitude) <= DEFAULT_MAP_RADIUS_KM
      );
      const nearbyShelters = sheltersWithOccupancy.filter(
        (s) => calculateHaversineDistance(h.latitude, h.longitude, s.latitude, s.longitude) <= DEFAULT_MAP_RADIUS_KM
      );
      let safeCount = 0;
      let distressCount = 0;
      let unaccountedCount = 0;
      let expectedHome = 0;
      let expectedShelter = 0;
      for (const m of h.members) {
        const exp = m.expectedLocations[0];
        if (exp?.expectedType === "HOME") expectedHome++;
        else if (exp?.expectedType === "SHELTER") expectedShelter++;
        const em = m.emergencyStatuses[0];
        if (em?.status === "SAFE") safeCount++;
        else if (em?.status === "IN_DISTRESS") distressCount++;
        else unaccountedCount++;
      }
      return {
        id: h.id,
        name: h.name,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        registeredPopulation: h.members.length,
        expectedHome,
        expectedShelter,
        confirmedSafe: safeCount,
        inDistress: distressCount,
        unaccounted: unaccountedCount,
        hasEmergency: distressCount > 0,
        nearbyFacilitiesCount: nearbyFacilities.length,
        nearbySheltersCount: nearbyShelters.length
      };
    });
    res.json({
      households: housesWithNearbyFacilities,
      shelters: sheltersWithOccupancy,
      facilities,
      roads,
      zones,
      emergencyRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch rescuer map data." });
  }
}

// src/server/routes/mapRoutes.ts
var router6 = Router6();
router6.get("/map/citizen", requireAuth, getCitizenMapData);
router6.get("/map/rescuer", requireAuth, requireRole(["RESCUER", "AUTHORITY"]), getRescuerMapData);
var mapRoutes_default = router6;

// src/server/routes/emergencyRoutes.ts
import { Router as Router7 } from "express";

// src/server/controllers/rescueController.ts
async function assignRescueTeam(req, res) {
  try {
    const { requestId } = req.params;
    const { teamName, notes } = req.body;
    const userId = req.user.userId;
    if (!teamName) {
      res.status(400).json({ error: "Team name is required." });
      return;
    }
    const request = await database_default.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { householdMember: true }
    });
    if (!request) {
      res.status(404).json({ error: "Emergency request not found." });
      return;
    }
    const assignment = await database_default.rescueAssignment.create({
      data: {
        emergencyRequestId: requestId,
        teamName: String(teamName).trim(),
        assignedByUserId: userId,
        status: "TEAM_ASSIGNED",
        notes: notes ? String(notes).trim() : "Rapid dispatch initialized"
      }
    });
    const updatedRequest = await database_default.emergencyRequest.update({
      where: { id: requestId },
      data: {
        rescueStatus: "TEAM_ASSIGNED"
      },
      include: {
        conditions: true,
        rescueAssignments: {
          orderBy: { assignedAt: "desc" }
        },
        householdMember: {
          include: { household: true }
        }
      }
    });
    res.status(201).json({
      message: "Rescue team successfully assigned",
      assignment,
      request: updatedRequest
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to assign rescue team." });
  }
}
async function updateRescueStatus(req, res) {
  try {
    const { requestId } = req.params;
    const { rescueStatus, notes } = req.body;
    const validStatuses = ["PENDING", "TEAM_ASSIGNED", "SAFELY_RESCUED", "NOT_FOUND"];
    if (!rescueStatus || !validStatuses.includes(rescueStatus)) {
      res.status(400).json({
        error: `Invalid rescue status. Must be one of: ${validStatuses.join(", ")}`
      });
      return;
    }
    const request = await database_default.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { householdMember: true }
    });
    if (!request) {
      res.status(404).json({ error: "Emergency request not found." });
      return;
    }
    if (rescueStatus === "SAFELY_RESCUED") {
      await database_default.emergencyStatus.upsert({
        where: {
          disasterId_householdMemberId: {
            disasterId: request.disasterId,
            householdMemberId: request.householdMemberId
          }
        },
        update: {
          status: "SAFE",
          updatedAt: /* @__PURE__ */ new Date()
        },
        create: {
          disasterId: request.disasterId,
          householdMemberId: request.householdMemberId,
          status: "SAFE"
        }
      });
    }
    const updated = await database_default.emergencyRequest.update({
      where: { id: requestId },
      data: {
        rescueStatus
      },
      include: {
        conditions: true,
        rescueAssignments: {
          orderBy: { assignedAt: "desc" }
        },
        householdMember: {
          include: { household: true }
        }
      }
    });
    if (notes) {
      const latestAssignment = await database_default.rescueAssignment.findFirst({
        where: { emergencyRequestId: requestId },
        orderBy: { assignedAt: "desc" }
      });
      if (latestAssignment) {
        await database_default.rescueAssignment.update({
          where: { id: latestAssignment.id },
          data: {
            status: rescueStatus,
            notes: String(notes).trim()
          }
        });
      }
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update rescue status." });
  }
}
async function getPriorityConfigs(req, res) {
  try {
    const configs = await database_default.priorityConfiguration.findMany();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch priority configurations." });
  }
}
async function updatePriorityConfig(req, res) {
  try {
    const { id } = req.params;
    const { weight, isActive } = req.body;
    const updated = await database_default.priorityConfiguration.update({
      where: { id },
      data: {
        weight: weight !== void 0 ? parseInt(weight, 10) : void 0,
        isActive: isActive !== void 0 ? Boolean(isActive) : void 0
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update priority configuration." });
  }
}

// src/server/routes/emergencyRoutes.ts
var router7 = Router7();
router7.get("/emergency-requests/:requestId", requireAuth, getEmergencyRequestById);
router7.put("/emergency-requests/:requestId", requireAuth, updateEmergencyRequest);
router7.post("/emergency-requests/:requestId/assign", requireAuth, requireRole("RESCUER"), assignRescueTeam);
router7.put("/emergency-requests/:requestId/rescue-status", requireAuth, requireRole("RESCUER"), updateRescueStatus);
router7.get("/priority-config", requireAuth, getPriorityConfigs);
router7.put("/priority-config/:id", requireAuth, requireRole("RESCUER"), updatePriorityConfig);
var emergencyRoutes_default = router7;

// src/server/routes/notificationRoutes.ts
import { Router as Router8 } from "express";

// src/server/controllers/notificationController.ts
async function getNotifications(req, res) {
  try {
    const userId = req.user.userId;
    const notifications = await database_default.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { disaster: true }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch notifications." });
  }
}
async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const notification = await database_default.notification.findUnique({ where: { id } });
    if (!notification) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }
    if (notification.userId !== userId && req.user.role !== "RESCUER") {
      res.status(403).json({ error: "Unauthorized." });
      return;
    }
    const updated = await database_default.notification.update({
      where: { id },
      data: {
        status: "READ",
        readAt: /* @__PURE__ */ new Date()
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to mark notification as read." });
  }
}

// src/server/routes/notificationRoutes.ts
var router8 = Router8();
router8.get("/notifications", requireAuth, getNotifications);
router8.put("/notifications/:id/read", requireAuth, markNotificationAsRead);
var notificationRoutes_default = router8;

// src/server/app.ts
function createApp() {
  const app2 = express();
  app2.use(cors());
  app2.use(express.json());
  app2.use((req, _res, next) => {
    const queryRoute = req.query?.__route;
    if (queryRoute) {
      delete req.query.__route;
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string") searchParams.set(key, value);
      }
      const qs = searchParams.toString();
      req.url = qs ? `${queryRoute}?${qs}` : queryRoute;
    } else {
      const candidate = req.headers["x-matched-path"] || req.headers["x-vercel-original-path"] || req.headers["x-forwarded-uri"] || req.originalUrl;
      if (candidate && candidate.startsWith("/api") && req.url !== candidate) {
        req.url = candidate;
      }
    }
    next();
  });
  app2.get(["/api/health", "/health"], async (req, res) => {
    try {
      await database_default.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        service: "STRIDE Disaster Intelligence Platform",
        version: "1.0.0-hackathon",
        database: "connected",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      res.status(500).json({
        status: "error",
        message: err.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  const mountRoutes = (prefix) => {
    app2.use(`${prefix}/auth`, authRoutes_default);
    app2.use(prefix, householdRoutes_default);
    app2.use(prefix, disasterRoutes_default);
    app2.use(prefix, shelterRoutes_default);
    app2.use(prefix, facilityRoutes_default);
    app2.use(prefix, mapRoutes_default);
    app2.use(prefix, emergencyRoutes_default);
    app2.use(prefix, notificationRoutes_default);
  };
  mountRoutes("/api");
  mountRoutes("");
  app2.use(errorHandler);
  return app2;
}
var app_default = createApp;

// src/server/serverless.ts
var app = app_default();
var serverless_default = app;
export {
  serverless_default as default
};
