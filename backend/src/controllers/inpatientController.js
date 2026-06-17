import { db } from "../config/db.js";
import { z } from "zod";
import {
  resolvePrice,
  computeRunningBill,
  priceForPharmacyItem,
} from "../inpatient/tariffService.js";
import {
  getCurrentBill,
  generateBill,
  finalizeBill,
  cancelBill,
  cancelCharge,
} from "../inpatient/billService.js";
import {
  collectPayment,
  voidPayment,
  refund,
  collections,
} from "../inpatient/billPaymentService.js";
import { computeNews2 } from "../inpatient/nursingService.js";
import { DISCHARGE_TYPES } from "../inpatient/dischargeService.js";
import { ipdAllowed, orderAllowed } from "../inpatient/rbac.js";
import { auditIpd } from "../inpatient/audit.js";
import * as orderableSearch from "../inpatient/orderableSearch.js";
import {
  createOrder,
  transition as orderTransition,
  completeOrder,
  listOrders,
  getOrder,
} from "../inpatient/orderService.js";
import { billProcedureOrder } from "../inpatient/orderBillingService.js";
import { billConsultation } from "../inpatient/consultationBillingService.js";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const wardSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  type: z.string().optional(),
  capacity: z.number().int().optional(),
  building: z.string().optional(),
  floor: z.string().optional(),
  chargeNurse: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
});

const bedSchema = z.object({
  wardId: z.string().min(1, "Ward ID is required"),
  bedNumber: z.string().min(1, "Bed number is required"),
  type: z.string().optional(),
  status: z.string().default("available"),
});

const admissionSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  bedId: z.string().optional(),
  wardId: z.string().optional(),
  admissionType: z.string().optional(),
  admissionReason: z.string().optional(),
  admissionDiagnosis: z.string().optional(),
  chiefComplaint: z.string().optional(),
  expectedLengthOfStay: z.number().int().optional(),
  depositAmount: z.number().optional(),
  admissionNotes: z.string().optional(),
  isCritical: z.boolean().optional(),
  criticalLevel: z.string().optional(),
  admittingDoctorId: z.string().optional(),
  attendingDoctorId: z.string().optional(),
});

// ─── Tenant-safety helpers ────────────────────────────────────────────────────
// Verify a row belongs to the caller's org BEFORE acting on it (closes IDOR /
// cross-tenant writes). Returns the row or null.
async function ownedAdmission(
  orgId,
  id,
  select = { id: true, bedId: true, status: true },
) {
  if (!id) return null;
  return db.admission.findFirst({
    where: { id, organizationId: orgId },
    select,
  });
}
async function ownedBed(
  orgId,
  id,
  select = { id: true, status: true, wardId: true, bedCategoryId: true },
) {
  if (!id) return null;
  return db.bed.findFirst({ where: { id, organizationId: orgId }, select });
}
async function ownedWard(orgId, id, select = { id: true }) {
  if (!id) return null;
  return db.ward.findFirst({ where: { id, organizationId: orgId }, select });
}
// Whitelists for the generic PATCH — prevents mass-assignment of org/billing/status.
const ADMISSION_UPDATABLE = [
  "admissionDiagnosis",
  "chiefComplaint",
  "admissionReason",
  "admissionNotes",
  "expectedLengthOfStay",
  "isCritical",
  "criticalLevel",
  "attendingDoctorId",
  "admittingDoctorId",
];
const BED_UPDATABLE = ["status", "type", "bedCategoryId"];
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function getAll(req, res) {
  try {
    const ORGANIZATION_ID =
      req.organizationId || process.env.ORGANIZATION_ID || "org-demo";
    const { resource, wardId, status } = req.query;

    // Parse and validate pagination parameters
    let limit = parseInt(req.query.limit) || 10;
    let offset = parseInt(req.query.offset) || 0;
    limit = Math.max(1, Math.min(limit, 1000));
    offset = Math.max(0, offset);

    if (resource === "wards") {
      const wards = await db.ward.findMany({
        where: { organizationId: ORGANIZATION_ID, isActive: true },
        include: {
          beds: true,
          department: { select: { id: true, name: true } },
        },
      });

      const result = wards.map((ward) => {
        const occupiedBeds = ward.beds.filter(
          (b) => b.status === "occupied",
        ).length;
        return {
          ...ward,
          occupiedBeds,
          availableBeds: (ward.capacity ?? ward.beds.length) - occupiedBeds,
          occupancyRate:
            ward.capacity && ward.capacity > 0
              ? Math.round((occupiedBeds / ward.capacity) * 100)
              : 0,
        };
      });

      return res.json({ success: true, data: result });
    }

    if (resource === "beds") {
      const where = { organizationId: ORGANIZATION_ID };
      if (wardId) where.wardId = wardId;
      if (status) where.status = status;

      const beds = await db.bed.findMany({
        where,
        include: { ward: true },
      });

      return res.json({ success: true, data: beds });
    }

    if (resource === "admissions") {
      const where = { organizationId: ORGANIZATION_ID };
      if (status) where.status = status;
      // Doctor portal: `mine=true` limits to the logged-in doctor's own patients
      // (attending or admitting). Scopes "see only my patients" without new endpoints.
      if (req.query.mine === "true" && req.user?.id) {
        where.OR = [
          { attendingDoctorId: req.user.id },
          { admittingDoctorId: req.user.id },
        ];
      }

      const [admissions, total] = await Promise.all([
        db.admission.findMany({
          where,
          include: {
            patient: {
              select: {
                id: true,
                mrn: true,
                firstName: true,
                lastName: true,
                gender: true,
                dateOfBirth: true,
                phonePrimary: true,
              },
            },
            bed: {
              include: {
                ward: {
                  include: { department: { select: { id: true, name: true } } },
                },
              },
            },
          },
          orderBy: { admissionDate: "desc" },
          take: limit,
          skip: offset,
        }),
        db.admission.count({ where }),
      ]);

      // Resolve admitting/attending doctor names (stored as bare user IDs)
      const doctorIds = [
        ...new Set(
          admissions
            .flatMap((a) => [a.attendingDoctorId, a.admittingDoctorId])
            .filter(Boolean),
        ),
      ];
      const doctorUsers = doctorIds.length
        ? await db.user.findMany({
            where: { id: { in: doctorIds } },
            select: { id: true, fullName: true },
          })
        : [];
      const doctorName = Object.fromEntries(
        doctorUsers.map((d) => [d.id, d.fullName]),
      );

      // Bill summary per admission (from Bill table — replaces legacy Admission.totalBillAmount).
      // Prefer the latest FINAL bill; fall back to the latest bill of any status.
      const admIds = admissions.map((a) => a.id);
      const bills = admIds.length
        ? await db.bill.findMany({
            where: {
              organizationId: ORGANIZATION_ID,
              admissionId: { in: admIds },
            },
            orderBy: { createdAt: "desc" },
            select: {
              admissionId: true,
              billNumber: true,
              status: true,
              billType: true,
              payableTotal: true,
              finalizedAt: true,
            },
          })
        : [];
      const billByAdm = {};
      for (const b of bills) {
        const cur = billByAdm[b.admissionId];
        if (!cur) billByAdm[b.admissionId] = b;
        else if (cur.status !== "FINAL" && b.status === "FINAL")
          billByAdm[b.admissionId] = b;
      }

      const data = admissions.map((a) => ({
        ...a,
        attendingDoctorName: doctorName[a.attendingDoctorId] || null,
        admittingDoctorName: doctorName[a.admittingDoctorId] || null,
        billSummary: billByAdm[a.id] || null,
      }));

      const hasMore = offset + limit < total;
      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);

      return res.json({
        success: true,
        data,
        meta: { total, limit, offset, page, totalPages, hasMore },
      });
    }

    if (resource === "notes") {
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admission = await db.admission.findUnique({
        where: { id: admissionId },
        select: { clinicalNotes: true },
      });
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      let notes = [];
      try {
        notes = admission.clinicalNotes
          ? JSON.parse(admission.clinicalNotes)
          : [];
      } catch {
        notes = [];
      }
      const mapped = notes.map((n) => ({
        id: n.id,
        type: n.noteType || "Note",
        text: n.note,
        createdAt: n.date,
        vitals: n.vitals || null,
      }));
      return res.json({ success: true, data: mapped });
    }

    // @deprecated LEGACY IPD billing (reads Admission.totalBillAmount/billGenerated/additionalCharges).
    // Desktop uses Bill/IpdCharge (resource: 'bill'). Retained only for the legacy mobile app.
    if (resource === "billing") {
      console.warn(
        "[DEPRECATED] inpatient GET resource=billing — use resource=bill (Bill/IpdCharge)",
      );
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admission = await db.admission.findUnique({
        where: { id: admissionId },
        select: {
          dailyRoomRate: true,
          totalBillAmount: true,
          billGenerated: true,
          additionalCharges: true,
        },
      });
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      if (!admission.billGenerated)
        return res.json({ success: true, data: null });
      let charges = [];
      try {
        charges = admission.additionalCharges
          ? JSON.parse(admission.additionalCharges)
          : [];
      } catch {
        charges = [];
      }
      return res.json({
        success: true,
        data: {
          id: admissionId,
          dailyRate: admission.dailyRoomRate,
          totalBillAmount: admission.totalBillAmount,
          billGenerated: admission.billGenerated,
          charges,
        },
      });
    }

    if (resource === "stats") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [totalBeds, occupiedBeds, todayAdmissions, todayDischarges] =
        await Promise.all([
          db.bed.count({ where: { organizationId: ORGANIZATION_ID } }),
          db.bed.count({
            where: { organizationId: ORGANIZATION_ID, status: "occupied" },
          }),
          db.admission.count({
            where: {
              organizationId: ORGANIZATION_ID,
              status: "admitted",
              admissionDate: { gte: todayStart, lte: todayEnd },
            },
          }),
          db.admission.count({
            where: {
              organizationId: ORGANIZATION_ID,
              status: "discharged",
              dischargeDate: { gte: todayStart, lte: todayEnd },
            },
          }),
        ]);

      const availableBeds = totalBeds - occupiedBeds;
      const occupancyRate =
        totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      return res.json({
        success: true,
        data: {
          totalBeds,
          occupiedBeds,
          availableBeds,
          todayAdmissions,
          todayDischarges,
          occupancyRate,
        },
      });
    }

    // ── Enterprise tariff engine ────────────────────────────────────────────
    if (resource === "tariff-preview") {
      const { admissionId, itemCode, base, serviceGroup, serviceDate } =
        req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      try {
        const result = await resolvePrice(ORGANIZATION_ID, admissionId, {
          itemCode,
          base: base !== undefined ? Number(base) : undefined,
          serviceGroup,
          serviceDate,
        });
        return res.json({ success: true, data: result });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, error: e.message });
      }
    }

    if (resource === "running-bill") {
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      try {
        const bill = await computeRunningBill(ORGANIZATION_ID, admissionId);
        return res.json({ success: true, data: bill });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, error: e.message });
      }
    }

    // Hidden dynamic pharmacy pricing — auto-pop the final price for a drug.
    // Normal users get only the final numbers; admins additionally get the breakdown.
    if (resource === "pharmacy-price") {
      const { admissionId, drugId, quantity } = req.query;
      if (!admissionId || !drugId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId and drugId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      try {
        const r = await priceForPharmacyItem(
          ORGANIZATION_ID,
          admissionId,
          drugId,
          { quantity },
        );
        const isAdmin =
          req.user?.role === "admin" || req.user?.role === "super_admin";
        const { breakdown, ...visible } = r;
        // Role-based visibility: breakdown (base price, markup rule, plan) admins only.
        return res.json({ success: true, data: isAdmin ? r : visible });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, error: e.message });
      }
    }

    // Phase 1: the persisted bill (current open DRAFT, else latest) + frozen line items.
    if (resource === "bill") {
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      const bill = await getCurrentBill(ORGANIZATION_ID, admissionId);
      const allBills = await db.bill.findMany({
        where: { organizationId: ORGANIZATION_ID, admissionId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          billNumber: true,
          status: true,
          billType: true,
          payableTotal: true,
          finalizedAt: true,
          createdAt: true,
        },
      });
      return res.json({ success: true, data: bill, history: allBills });
    }

    // Phase 2: payment ledger for a bill (or whole admission via floating payments)
    if (resource === "payments") {
      const { billId, admissionId } = req.query;
      if (!billId && !admissionId)
        return res
          .status(400)
          .json({ success: false, error: "billId or admissionId required" });
      const where = { organizationId: ORGANIZATION_ID };
      if (billId) where.billId = billId;
      if (admissionId) {
        where.admissionId = admissionId;
        const admissionBelongsToOrg = await ownedAdmission(
          ORGANIZATION_ID,
          admissionId,
        );
        if (!admissionBelongsToOrg) {
          return res
            .status(404)
            .json({ success: false, error: "Admission not found" });
        }
      }
      const rows = await db.billPayment.findMany({
        where,
        orderBy: { paidAt: "desc" },
      });
      return res.json({ success: true, data: rows });
    }

    // Phase 2: cashier daily/shift collection report
    if (resource === "collections") {
      const { from, to, cashierId } = req.query;
      const report = await collections(ORGANIZATION_ID, {
        from,
        to,
        cashierId,
      });
      return res.json({ success: true, data: report });
    }

    if (resource === "bed-categories") {
      const cats = await db.bedCategory.findMany({
        where: { organizationId: ORGANIZATION_ID, isActive: true },
        orderBy: { rank: "asc" },
      });
      return res.json({ success: true, data: cats });
    }

    if (resource === "tariff-plans") {
      const plans = await db.tariffPlan.findMany({
        where: { organizationId: ORGANIZATION_ID, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      return res.json({ success: true, data: plans });
    }

    // ── Phase 2: Nursing station ─────────────────────────────────────────────
    // Clinical time-series: never silently truncate — paginate with a generous cap.
    const clinLimit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const clinOffset = Math.max(0, parseInt(req.query.offset) || 0);

    if (resource === "vitals") {
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const [vitals, total] = await Promise.all([
        db.vitalsRecord.findMany({
          where: { organizationId: ORGANIZATION_ID, admissionId },
          orderBy: { recordedAt: "desc" },
          take: clinLimit,
          skip: clinOffset,
        }),
        db.vitalsRecord.count({
          where: { organizationId: ORGANIZATION_ID, admissionId },
        }),
      ]);
      return res.json({
        success: true,
        data: vitals,
        meta: {
          total,
          limit: clinLimit,
          offset: clinOffset,
          hasMore: clinOffset + clinLimit < total,
        },
      });
    }

    if (resource === "clinical-notes-v2") {
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const [notes, total] = await Promise.all([
        db.clinicalNote.findMany({
          where: { organizationId: ORGANIZATION_ID, admissionId },
          orderBy: { authoredAt: "desc" },
          take: clinLimit,
          skip: clinOffset,
        }),
        db.clinicalNote.count({
          where: { organizationId: ORGANIZATION_ID, admissionId },
        }),
      ]);
      return res.json({
        success: true,
        data: notes,
        meta: {
          total,
          limit: clinLimit,
          offset: clinOffset,
          hasMore: clinOffset + clinLimit < total,
        },
      });
    }

    if (resource === "medication-administration") {
      const { admissionId } = req.query;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const [records, total] = await Promise.all([
        db.medicationAdministration.findMany({
          where: { organizationId: ORGANIZATION_ID, admissionId },
          orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
          take: clinLimit,
          skip: clinOffset,
        }),
        db.medicationAdministration.count({
          where: { organizationId: ORGANIZATION_ID, admissionId },
        }),
      ]);
      return res.json({
        success: true,
        data: records,
        meta: {
          total,
          limit: clinLimit,
          offset: clinOffset,
          hasMore: clinOffset + clinLimit < total,
        },
      });
    }

    // ── Phase 3A: Clinical Orders (reads; ungated like other IPD reads) ──
    if (resource === "orderables") {
      const data = await orderableSearch.search(ORGANIZATION_ID, {
        q: req.query.q,
        type: req.query.type,
      });
      return res.json({ success: true, data });
    }
    if (resource === "orders") {
      const data = await listOrders(ORGANIZATION_ID, {
        admissionId: req.query.admissionId,
        type: req.query.type,
        status: req.query.status,
      });
      return res.json({ success: true, data });
    }
    if (resource === "order") {
      if (!req.query.id)
        return res.status(400).json({ success: false, error: "id required" });
      const data = await getOrder(ORGANIZATION_ID, req.query.id);
      return res.json({ success: true, data });
    }
    if (resource === "order-worklist") {
      const data = await listOrders(ORGANIZATION_ID, {
        type: req.query.type,
        status: req.query.status,
        withContext: true,
      });
      return res.json({ success: true, data });
    }

    // ── ipd-consultation GET ──────────────────────────────────────────────────
    if (resource === "ipd-consultation") {
      const where = { organizationId: ORGANIZATION_ID };
      if (req.query.admissionId) where.admissionId = req.query.admissionId;
      if (req.query.status)      where.status      = req.query.status;
      // Doctor portal: mine=true → consultations assigned to me OR requested by me
      if (req.query.mine === "true" && req.user?.id) {
        where.OR = [
          { consultingDoctorId: req.user.id },
          { requestedById:      req.user.id },
        ];
      }
      const consultations = await db.ipdConsultation.findMany({
        where,
        include: {
          consultingDoctor: { select: { id: true, fullName: true } },
          requestedBy:      { select: { id: true, fullName: true } },
          department:       { select: { id: true, name: true } },
          ipdCharge:        { select: { id: true, lineTotal: true, status: true } },
        },
        orderBy: { requestedAt: "desc" },
      });
      return res.json({ success: true, data: consultations });
    }

    return res
      .status(400)
      .json({
        error:
          "Invalid resource. Use: wards, beds, admissions, notes, billing, stats, tariff-preview, running-bill, bed-categories, tariff-plans, orderables, orders, order, order-worklist, ipd-consultation",
      });

  } catch (err) {
    console.error("inpatient getAll error:", err);
    if (err?.status)
      return res
        .status(err.status)
        .json({ success: false, code: err.code, error: err.message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function create(req, res) {
  try {
    const ORGANIZATION_ID =
      req.organizationId || process.env.ORGANIZATION_ID || "org-demo";
    const { resource, ...body } = req.body;

    if (!ipdAllowed(req, resource)) {
      return res
        .status(403)
        .json({
          success: false,
          code: "FORBIDDEN",
          error: `Your role may not perform this IPD action (${resource})`,
        });
    }

    // ── ipd-consultation POST ─────────────────────────────────────────────────
    if (resource === "ipd-consultation") {
      const { admissionId, consultingDoctorId, departmentId,
               referralReason, chargeItemCode, scheduledAt } = body;
      if (!admissionId || !consultingDoctorId) {
        return res.status(400).json({ success: false, error: "admissionId and consultingDoctorId are required" });
      }
      const admission = await ownedAdmission(ORGANIZATION_ID, admissionId);
      if (!admission)
        return res.status(404).json({ success: false, error: "Admission not found" });
      if (admission.status !== "admitted")
        return res.status(409).json({ success: false, error: "Patient is not currently admitted" });

      const consultation = await db.ipdConsultation.create({
        data: {
          organizationId:    ORGANIZATION_ID,
          admissionId,
          consultingDoctorId,
          requestedById:     req.user?.id  || null,
          departmentId:      departmentId  || null,
          referralReason:    referralReason || null,
          chargeItemCode:    chargeItemCode || null,
          scheduledAt:       scheduledAt ? new Date(scheduledAt) : null,
          status:            "REQUESTED",
        },
      });
      await auditIpd(req, ORGANIZATION_ID, { action: "create", entityType: "ipd.consultation", entityId: consultation.id, newValues: consultation });
      return res.status(201).json({ success: true, data: consultation });
    }

    if (resource === "ward") {
      const parsed = wardSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const capacity = Math.max(1, parseInt(parsed.data.capacity) || 10);
      const ward = await db.ward.create({
        data: {
          ...parsed.data,
          capacity,
          organizationId: ORGANIZATION_ID,
          isActive: true,
        },
      });

      await db.bed.createMany({
        data: Array.from({ length: capacity }, (_, i) => ({
          organizationId: ORGANIZATION_ID,
          wardId: ward.id,
          bedNumber: String(i + 1),
          type: "Standard",
          status: "available",
        })),
      });

      const wardWithBeds = await db.ward.findUnique({
        where: { id: ward.id },
        include: { beds: true },
      });

      return res.status(201).json({ success: true, data: wardWithBeds });
    }

    if (resource === "bed") {
      const parsed = bedSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const bed = await db.bed.create({
        data: {
          ...parsed.data,
          organizationId: ORGANIZATION_ID,
        },
        include: { ward: true },
      });

      return res.status(201).json({ success: true, data: bed });
    }

    if (resource === "admission") {
      const parsed = admissionSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { bedId, wardId: _wardId, ...admissionData } = parsed.data;

      // H4: one active admission per patient.
      const activeForPatient = await db.admission.findFirst({
        where: {
          organizationId: ORGANIZATION_ID,
          patientId: admissionData.patientId,
          status: "admitted",
        },
        select: { id: true },
      });
      if (activeForPatient) {
        return res
          .status(409)
          .json({
            success: false,
            code: "IPD_PATIENT_ALREADY_ADMITTED",
            error: "Patient already has an active admission",
          });
      }

      // Resolve the default payer plan up-front (read; safe outside the tx).
      const payerType = body.payerType || "CASH";
      const plan =
        (await db.tariffPlan.findFirst({
          where: {
            organizationId: ORGANIZATION_ID,
            payerType,
            isDefault: true,
          },
        })) ||
        (await db.tariffPlan.findFirst({
          where: { organizationId: ORGANIZATION_ID, payerType },
        })) ||
        (await db.tariffPlan.findFirst({
          where: { organizationId: ORGANIZATION_ID, isDefault: true },
        }));

      let admission;
      try {
        admission = await db.$transaction(async (tx) => {
          // C3: atomically claim the bed — only succeeds if it is currently available.
          let bedCategoryId = null;
          if (bedId) {
            const claimed = await tx.bed.updateMany({
              where: {
                id: bedId,
                organizationId: ORGANIZATION_ID,
                status: "available",
              },
              data: { status: "occupied" },
            });
            if (claimed.count !== 1) {
              throw Object.assign(new Error("Bed is no longer available"), {
                status: 409,
                code: "IPD_BED_UNAVAILABLE",
              });
            }
            const bed = await tx.bed.findUnique({
              where: { id: bedId },
              select: { bedCategoryId: true },
            });
            bedCategoryId = bed?.bedCategoryId || null;
          }

          const adm = await tx.admission.create({
            data: {
              ...admissionData,
              ...(bedId ? { bedId } : {}),
              organizationId: ORGANIZATION_ID,
              status: "admitted",
              admissionState: "ADMITTED",
              admissionDate: new Date(),
            },
            include: {
              patient: {
                select: {
                  id: true,
                  mrn: true,
                  firstName: true,
                  lastName: true,
                  gender: true,
                  dateOfBirth: true,
                  phonePrimary: true,
                },
              },
              bed: { include: { ward: true } },
            },
          });

          if (bedId) {
            await tx.bedOccupancy.create({
              data: {
                organizationId: ORGANIZATION_ID,
                admissionId: adm.id,
                bedId,
                bedCategoryId,
                startAt: adm.admissionDate,
                reason: "ADMIT",
              },
            });
          }
          if (plan) {
            await tx.patientTariff.create({
              data: {
                organizationId: ORGANIZATION_ID,
                admissionId: adm.id,
                planId: plan.id,
                payerType,
              },
            });
          }
          return adm;
        });
      } catch (e) {
        if (e.status)
          return res
            .status(e.status)
            .json({ success: false, code: e.code, error: e.message });
        // DB-level partial unique indexes (active admission per patient / open occupancy per bed)
        if (e.code === "P2002")
          return res
            .status(409)
            .json({
              success: false,
              code: "IPD_CONFLICT",
              error:
                "Patient already admitted or bed already occupied (DB guard)",
            });
        throw e;
      }

      await auditIpd(req, ORGANIZATION_ID, {
        action: "create",
        entityType: "ipd.admission",
        entityId: admission.id,
        after: {
          patientId: admission.patientId,
          bedId: admission.bedId,
          admissionType: admission.admissionType,
        },
      });
      return res.status(201).json({ success: true, data: admission });
    }

    if (resource === "transfer") {
      const { admissionId, toBedId, transferReason, authorName } = body;
      if (!admissionId || !toBedId) {
        return res
          .status(400)
          .json({ success: false, error: "admissionId and toBedId required" });
      }
      const admission = await db.admission.findFirst({
        where: { id: admissionId, organizationId: ORGANIZATION_ID },
      });
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      if (admission.status !== "admitted")
        return res
          .status(409)
          .json({
            success: false,
            error: "Only an admitted patient can be transferred",
          });
      if (admission.bedId === toBedId)
        return res
          .status(400)
          .json({ success: false, error: "Patient is already in that bed" });

      // Resolve from/to bed + ward names so the Movement tab can render the journey.
      const [fromBed, toBed] = await Promise.all([
        admission.bedId
          ? db.bed.findFirst({
              where: { id: admission.bedId, organizationId: ORGANIZATION_ID },
              include: { ward: true },
            })
          : null,
        db.bed.findFirst({
          where: { id: toBedId, organizationId: ORGANIZATION_ID },
          include: { ward: true },
        }),
      ]);
      if (!toBed)
        return res
          .status(404)
          .json({ success: false, error: "Target bed not found" });
      const fromWardName = fromBed?.ward?.name || "Unknown Ward";
      const fromBedNo = fromBed?.bedNumber || "—";
      const toWardName = toBed?.ward?.name || "Unknown Ward";
      const toBedNo = toBed?.bedNumber || "—";

      let existing = [];
      try {
        existing = admission.clinicalNotes
          ? JSON.parse(admission.clinicalNotes)
          : [];
      } catch {
        existing = [];
      }
      if (!Array.isArray(existing)) existing = [];
      const transferNote = {
        id: `note-${Date.now()}`,
        date: new Date().toISOString(),
        noteType: "transfer",
        note: `WARD TRANSFER NOTE: Patient moved from ${fromWardName} (Bed ${fromBedNo}) to ${toWardName} (Bed ${toBedNo}).${transferReason ? ` Reason: ${transferReason}` : ""}`,
        authorName: authorName || "System",
      };
      const now = new Date();

      let updated;
      try {
        updated = await db.$transaction(async (tx) => {
          // C3: atomically claim the destination bed (must be available).
          const claimed = await tx.bed.updateMany({
            where: {
              id: toBedId,
              organizationId: ORGANIZATION_ID,
              status: "available",
            },
            data: { status: "occupied" },
          });
          if (claimed.count !== 1)
            throw Object.assign(
              new Error("Target bed is no longer available"),
              { status: 409, code: "IPD_BED_UNAVAILABLE" },
            );

          // Free the old bed (housekeeping removed → straight to available).
          if (admission.bedId) {
            await tx.bed.update({
              where: { id: admission.bedId },
              data: { status: "available" },
            });
          }
          // Close + open occupancy segments.
          await tx.bedOccupancy.updateMany({
            where: { admissionId, endAt: null },
            data: { endAt: now },
          });
          await tx.bedOccupancy.create({
            data: {
              organizationId: ORGANIZATION_ID,
              admissionId,
              bedId: toBedId,
              bedCategoryId: toBed?.bedCategoryId || null,
              startAt: now,
              reason: "TRANSFER",
            },
          });
          return tx.admission.update({
            where: { id: admissionId },
            data: {
              bedId: toBedId,
              status: "admitted",
              clinicalNotes: JSON.stringify([...existing, transferNote]),
            },
            include: {
              patient: {
                select: {
                  id: true,
                  mrn: true,
                  firstName: true,
                  lastName: true,
                },
              },
              bed: { include: { ward: true } },
            },
          });
        });
      } catch (e) {
        if (e.status)
          return res
            .status(e.status)
            .json({ success: false, code: e.code, error: e.message });
        if (e.code === "P2002")
          return res
            .status(409)
            .json({
              success: false,
              code: "IPD_BED_UNAVAILABLE",
              error: "Target bed already has an open occupancy (DB guard)",
            });
        throw e;
      }
      await auditIpd(req, ORGANIZATION_ID, {
        action: "transfer",
        entityType: "ipd.admission",
        entityId: admissionId,
        before: { bedId: admission.bedId },
        after: { bedId: toBedId, reason: transferReason || null },
      });
      return res.json({ success: true, data: updated });
    }

    if (resource === "sync-beds") {
      const { wardId } = body;
      if (!wardId)
        return res
          .status(400)
          .json({ success: false, error: "wardId required" });

      const ward = await db.ward.findFirst({
        where: { id: wardId, organizationId: ORGANIZATION_ID },
        include: { beds: true },
      });
      if (!ward)
        return res
          .status(404)
          .json({ success: false, error: "Ward not found" });

      const capacity = Math.max(ward.beds.length, ward.capacity || 10);
      const existingNumbers = new Set(ward.beds.map((b) => b.bedNumber));
      const toCreate = [];
      for (let i = 1; i <= capacity; i++) {
        const num = String(i);
        if (!existingNumbers.has(num)) {
          toCreate.push({
            organizationId: ORGANIZATION_ID,
            wardId,
            bedNumber: num,
            type: "Standard",
            status: "available",
          });
        }
      }
      if (toCreate.length > 0) await db.bed.createMany({ data: toCreate });

      const wardWithBeds = await db.ward.findUnique({
        where: { id: wardId },
        include: { beds: { orderBy: { bedNumber: "asc" } } },
      });
      return res.json({ success: true, data: wardWithBeds });
    }

    if (resource === "note") {
      // Frontend-friendly alias: accepts { admissionId, type, text, vitals: {bp,temp,pulse,spo2,weight} }
      const { admissionId, type, text, vitals } = body;
      if (!admissionId || !text)
        return res
          .status(400)
          .json({ success: false, error: "admissionId and text required" });
      const admission = await db.admission.findFirst({
        where: { id: admissionId, organizationId: ORGANIZATION_ID },
        select: { clinicalNotes: true },
      });
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      let existing = [];
      try {
        existing = admission.clinicalNotes
          ? JSON.parse(admission.clinicalNotes)
          : [];
      } catch {
        existing = [];
      }
      const newNote = {
        id: `note-${Date.now()}`,
        date: new Date().toISOString(),
        noteType: type || "Nursing",
        note: text,
        vitals: vitals || null,
      };
      await db.admission.update({
        where: { id: admissionId },
        data: { clinicalNotes: JSON.stringify([...existing, newNote]) },
      });
      return res
        .status(201)
        .json({
          success: true,
          data: {
            ...newNote,
            type: newNote.noteType,
            text: newNote.note,
            createdAt: newNote.date,
          },
        });
    }

    // @deprecated LEGACY — writes Admission.totalBillAmount/billGenerated. Desktop uses bill-generate/bill-finalize.
    if (resource === "billing") {
      console.warn(
        "[DEPRECATED] inpatient POST resource=billing — use resource=bill-generate / bill-finalize",
      );
      const { admissionId, dailyRate } = body;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admission = await db.admission.findFirst({
        where: { id: admissionId, organizationId: ORGANIZATION_ID },
        select: { admissionDate: true, additionalCharges: true },
      });
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      const days = Math.max(
        1,
        Math.round(
          (Date.now() - new Date(admission.admissionDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const rate = parseFloat(dailyRate) || 0;
      let charges = [];
      try {
        charges = admission.additionalCharges
          ? JSON.parse(admission.additionalCharges)
          : [];
      } catch {
        charges = [];
      }
      const extraTotal = charges.reduce(
        (s, c) => s + (c.amount || 0) * (c.quantity || 1),
        0,
      );
      const total = rate * days + extraTotal;
      await db.admission.update({
        where: { id: admissionId },
        data: {
          dailyRoomRate: rate,
          totalBillAmount: total,
          billGenerated: true,
        },
      });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "update",
        entityType: "ipd.billing",
        entityId: admissionId,
        after: { dailyRate: rate, totalBillAmount: total, billGenerated: true },
      });
      return res
        .status(201)
        .json({
          success: true,
          data: {
            id: admissionId,
            dailyRate: rate,
            totalBillAmount: total,
            billGenerated: true,
            charges,
          },
        });
    }

    // @deprecated LEGACY — writes Admission.additionalCharges (JSON). Desktop uses resource=post-charge (IpdCharge).
    if (resource === "charge") {
      console.warn(
        "[DEPRECATED] inpatient POST resource=charge — use resource=post-charge (IpdCharge)",
      );
      // billingId is the admissionId (billing is stored on admission)
      const { billingId, name, type, amount, quantity } = body;
      if (!billingId || !name || amount === undefined)
        return res
          .status(400)
          .json({
            success: false,
            error: "billingId, name, and amount required",
          });
      const admission = await db.admission.findFirst({
        where: { id: billingId, organizationId: ORGANIZATION_ID },
        select: {
          additionalCharges: true,
          admissionDate: true,
          dailyRoomRate: true,
        },
      });
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      let charges = [];
      try {
        charges = admission.additionalCharges
          ? JSON.parse(admission.additionalCharges)
          : [];
      } catch {
        charges = [];
      }
      const newCharge = {
        id: `charge-${Date.now()}`,
        name,
        type: type || "Other",
        amount: parseFloat(amount) || 0,
        quantity: parseInt(quantity) || 1,
        date: new Date().toISOString(),
      };
      charges.push(newCharge);
      const days = Math.max(
        1,
        Math.round(
          (Date.now() - new Date(admission.admissionDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const extraTotal = charges.reduce(
        (s, c) => s + (c.amount || 0) * (c.quantity || 1),
        0,
      );
      const total = (admission.dailyRoomRate || 0) * days + extraTotal;
      await db.admission.update({
        where: { id: billingId },
        data: {
          additionalCharges: JSON.stringify(charges),
          totalBillAmount: total,
        },
      });
      return res.status(201).json({ success: true, data: newCharge });
    }

    // Enterprise: post a charge line, auto-priced by the tariff engine (idempotent per source).
    // Two modes: pharmacyDrugId (price from pharmacy catalog + ward markup + GST) OR
    // itemCode / description+base (generic tariff item).
    if (resource === "post-charge") {
      const {
        admissionId,
        pharmacyDrugId,
        itemCode,
        description,
        serviceGroup,
        base,
        quantity,
        serviceDate,
        sourceModule,
        sourceRef,
      } = body;
      if (
        !admissionId ||
        (!pharmacyDrugId && !itemCode && (!description || base === undefined))
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "admissionId and (pharmacyDrugId OR itemCode OR description+base) required",
          });
      }
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      // Idempotency: skip if this source line was already posted (org-scoped).
      if (sourceModule && sourceRef) {
        const dup = await db.ipdCharge
          .findFirst({
            where: { organizationId: ORGANIZATION_ID, sourceModule, sourceRef },
          })
          .catch(() => null);
        if (dup) return res.json({ success: true, data: dup, deduped: true });
      }

      const r2 = (n) => Math.round((n || 0) * 100) / 100;
      const discountPct = Number(body.discountPct) || 0;
      let chargeData;
      try {
        if (pharmacyDrugId) {
          // Pharmacy item: base from catalog, ward markup applied, GST captured.
          const p = await priceForPharmacyItem(
            ORGANIZATION_ID,
            admissionId,
            pharmacyDrugId,
            { quantity, serviceDate },
          );
          const gross = r2(p.unitPrice * p.quantity);
          const discountAmount = r2((gross * discountPct) / 100);
          const taxable = r2(gross - discountAmount);
          const taxAmount = r2((taxable * (p.taxPct || 0)) / 100);
          chargeData = {
            chargeItemId: null,
            description:
              description ||
              `${p.drug.name}${p.drug.form ? ` (${p.drug.form})` : ""}`,
            serviceGroup: "PHARMACY",
            unitPrice: p.unitPrice,
            quantity: p.quantity,
            taxPct: p.taxPct || 0,
            taxAmount,
            discountPct,
            discountAmount,
            lineTotal: r2(taxable + taxAmount),
            resolvedFrom: {
              ...p.breakdown,
              pharmacyDrugId: p.drug.id,
              gstPct: p.taxPct,
            },
          };
        } else {
          const priced = await resolvePrice(ORGANIZATION_ID, admissionId, {
            itemCode,
            base: base !== undefined ? Number(base) : undefined,
            serviceGroup,
            serviceDate,
          });
          const qty = parseFloat(quantity) || 1;
          // Frozen tax from the charge master (if this maps to one), else 0.
          let taxPct = 0;
          if (priced.chargeItem?.id) {
            const cm = await db.chargeMaster
              .findUnique({
                where: { id: priced.chargeItem.id },
                select: { taxRatePct: true },
              })
              .catch(() => null);
            taxPct = cm?.taxRatePct || 0;
          }
          const gross = r2(priced.price * qty);
          const discountAmount = r2((gross * discountPct) / 100);
          const taxable = r2(gross - discountAmount);
          const taxAmount = r2((taxable * taxPct) / 100);
          chargeData = {
            chargeItemId: priced.chargeItem?.id || null,
            description: description || priced.chargeItem?.name || itemCode,
            serviceGroup: priced.serviceGroup || serviceGroup || "OTHER",
            unitPrice: priced.price,
            quantity: qty,
            taxPct,
            taxAmount,
            discountPct,
            discountAmount,
            lineTotal: r2(taxable + taxAmount),
            resolvedFrom: {
              planId: priced.plan?.id,
              bedCategoryId: priced.bedCategoryId,
              ruleId: priced.rule?.id,
              base: priced.base,
            },
          };
        }
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, error: e.message });
      }

      const charge = await db.ipdCharge.create({
        data: {
          organizationId: ORGANIZATION_ID,
          admissionId,
          ...chargeData,
          status: "ACTIVE",
          postedById: req.user?.id || null,
          postedByName: req.user?.fullName || null,
          serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
          sourceModule: sourceModule || (pharmacyDrugId ? "PHARMACY" : "IPD"),
          sourceRef: sourceRef || null,
        },
      });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "charge",
        entityType: "ipd.charge",
        entityId: charge.id,
        after: {
          admissionId,
          description: charge.description,
          unitPrice: charge.unitPrice,
          quantity: charge.quantity,
          serviceGroup: charge.serviceGroup,
        },
      });
      return res.status(201).json({ success: true, data: charge });
    }

    // Phase 2: record vitals (auto-computes NEWS2 early-warning score)
    if (resource === "vitals") {
      const { admissionId } = body;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      const num = (value) => {
        const isEmptyValue =
          value === "" || value === undefined || value === null;

        if (isEmptyValue) {
          return null;
        }

        return Number(value);
      };
      const fields = {
        systolicBp: num(body.systolicBp),
        diastolicBp: num(body.diastolicBp),
        heartRate: num(body.heartRate),
        respiratoryRate: num(body.respiratoryRate),
        spo2: num(body.spo2),
        tempC: num(body.tempC),
        painScore: num(body.painScore),
        gcs: num(body.gcs),
        intakeMl: num(body.intakeMl),
        outputMl: num(body.outputMl),
        bloodSugar: num(body.bloodSugar),
        consciousness: body.consciousness || null,
      };
      const news = computeNews2(fields);
      const rec = await db.vitalsRecord.create({
        data: {
          organizationId: ORGANIZATION_ID,
          admissionId,
          ...fields,
          newsScore: news.score,
          newsRisk: news.risk,
          recordedById: req.user?.id || null,
          recordedByName: body.recordedByName || req.user?.fullName || null,
          notes: body.notes || null,
          recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
        },
      });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "create",
        entityType: "ipd.vitals",
        entityId: rec.id,
        after: {
          admissionId,
          newsScore: rec.newsScore,
          newsRisk: rec.newsRisk,
        },
      });
      return res.status(201).json({ success: true, data: rec });
    }

    // Phase 2: append a structured clinical note (append-only)
    if (resource === "note-v2") {
      const { admissionId, body: noteBody, noteType, parentId, vitals } = body;
      const hasRequiredFields = admissionId && noteBody;

      if (!hasRequiredFields) {
        return res
          .status(400)
          .json({ success: false, error: "admissionId and body required" });
      }

      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }

      const note = await db.clinicalNote.create({
        data: {
          organizationId: ORGANIZATION_ID,
          admissionId,
          noteType: noteType || "PROGRESS",
          body: noteBody,
          authorId: req.user?.id || null,
          authorName: body.authorName || req.user?.fullName || null,
          parentId: parentId || null,
          vitals: vitals || undefined,
        },
      });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "create",
        entityType: "ipd.note",
        entityId: note.id,
        after: { admissionId, noteType: note.noteType },
      });
      return res.status(201).json({ success: true, data: note });
    }

    // Phase 2: record a medication administration (eMAR)
    if (resource === "medication-administration") {
      const { admissionId, drugName, status } = body;
      if (!admissionId || !drugName)
        return res
          .status(400)
          .json({ success: false, error: "admissionId and drugName required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }

      // Default to GIVEN when no status is sent.
      const finalStatus = status || "GIVEN";

      // Optional planned time for the dose.
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

      // Stamp the administration time only when the dose was actually GIVEN;
      // use the time the client sent, else now.
      const administeredAt =
        finalStatus === "GIVEN"
          ? body.administeredAt
            ? new Date(body.administeredAt)
            : new Date()
          : null;

      const rec = await db.medicationAdministration.create({
        data: {
          organizationId: ORGANIZATION_ID,
          admissionId,
          prescriptionId: body.prescriptionId || null,
          drugName,
          dosage: body.dosage || null,
          route: body.route || null,
          scheduledAt,
          administeredAt,
          status: finalStatus,
          reason: body.reason || null,
          nurseId: req.user?.id || null,
          nurseName: body.nurseName || req.user?.fullName || null,
        },
      });
      // Audit trail: what was done, to which record, and a small snapshot of the result.
      const auditEntry = {
        action: "create",
        entityType: "ipd.medication-administration",
        entityId: rec.id,
        after: {
          admissionId,
          drugName: rec.drugName,
          status: rec.status,
        },
      };
      await auditIpd(req, ORGANIZATION_ID, auditEntry);

      return res.status(201).json({ success: true, data: rec });
    }

    // ── Phase 1 billing ──────────────────────────────────────────────────────
    if (resource === "bill-generate") {
      const { admissionId } = body;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      try {
        const bill = await generateBill(
          ORGANIZATION_ID,
          admissionId,
          req.user?.id,
        );
        await auditIpd(req, ORGANIZATION_ID, {
          action: "update",
          entityType: "ipd.bill",
          entityId: bill.id,
          after: {
            admissionId,
            status: bill.status,
            payableTotal: bill.payableTotal,
          },
        });
        return res.status(201).json({ success: true, data: bill });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    if (resource === "bill-finalize") {
      const { admissionId, billType } = body;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const admissionBelongsToOrg = await ownedAdmission(
        ORGANIZATION_ID,
        admissionId,
      );
      if (!admissionBelongsToOrg) {
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      }
      try {
        const bill = await finalizeBill(ORGANIZATION_ID, admissionId, {
          userId: req.user?.id,
          billType,
        });
        await auditIpd(req, ORGANIZATION_ID, {
          action: "finalize",
          entityType: "ipd.bill",
          entityId: bill.id,
          after: {
            admissionId,
            billNumber: bill.billNumber,
            payableTotal: bill.payableTotal,
          },
        });
        return res.json({ success: true, data: bill });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    if (resource === "bill-cancel") {
      const { billId, reason } = body;
      if (!billId)
        return res
          .status(400)
          .json({ success: false, error: "billId required" });
      try {
        const bill = await cancelBill(ORGANIZATION_ID, billId, { reason });
        await auditIpd(req, ORGANIZATION_ID, {
          action: "cancel",
          entityType: "ipd.bill",
          entityId: billId,
          after: { status: "CANCELLED", reason: reason || null },
        });
        return res.json({ success: true, data: bill });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    // Phase 2: collect a payment / advance
    if (resource === "payment") {
      const { billId, amount, method, reference, type, note, idempotencyKey } =
        body;
      try {
        const r = await collectPayment(ORGANIZATION_ID, {
          billId,
          amount,
          method,
          reference,
          type,
          note,
          idempotencyKey,
          userId: req.user?.id,
          userName: req.user?.fullName,
        });
        if (!r.deduped)
          await auditIpd(req, ORGANIZATION_ID, {
            action: "payment",
            entityType: "ipd.payment",
            entityId: r.payment.id,
            after: {
              billId,
              amount: r.payment.amount,
              method,
              receipt: r.payment.receiptNumber,
              balanceDue: r.totals?.balanceDue,
            },
          });
        return res
          .status(201)
          .json({
            success: true,
            data: r.payment,
            totals: r.totals,
            deduped: r.deduped || false,
          });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    // Phase 2: void a payment (audit-safe)
    if (resource === "void-payment") {
      const { paymentId, reason } = body;
      if (!paymentId)
        return res
          .status(400)
          .json({ success: false, error: "paymentId required" });
      try {
        const p = await voidPayment(ORGANIZATION_ID, paymentId, { reason });
        await auditIpd(req, ORGANIZATION_ID, {
          action: "void",
          entityType: "ipd.payment",
          entityId: paymentId,
          after: { status: "VOID", reason: reason || null },
        });
        return res.json({ success: true, data: p });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    // Phase 2: refund (signed-negative ledger entry; credit note in Phase 3)
    if (resource === "refund") {
      const { billId, amount, reason, method } = body;
      try {
        const r = await refund(ORGANIZATION_ID, {
          billId,
          amount,
          reason,
          method,
          userId: req.user?.id,
          userName: req.user?.fullName,
        });
        await auditIpd(req, ORGANIZATION_ID, {
          action: "refund",
          entityType: "ipd.payment",
          entityId: r.payment.id,
          after: {
            billId,
            amount: r.payment.amount,
            receipt: r.payment.receiptNumber,
            balanceDue: r.totals?.balanceDue,
          },
        });
        return res
          .status(201)
          .json({ success: true, data: r.payment, totals: r.totals });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    if (resource === "cancel-charge") {
      const { chargeId, status: cStatus, reason } = body;
      if (!chargeId)
        return res
          .status(400)
          .json({ success: false, error: "chargeId required" });
      try {
        const charge = await cancelCharge(ORGANIZATION_ID, chargeId, {
          status: cStatus,
          reason,
          userId: req.user?.id,
        });
        await auditIpd(req, ORGANIZATION_ID, {
          action: "cancel",
          entityType: "ipd.charge",
          entityId: chargeId,
          after: { status: charge.status, reason: reason || null },
        });
        return res.json({ success: true, data: charge });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    // Finalize discharge — gated on a paid bill (NORMAL), with bed turnover.
    if (resource === "discharge-finalize") {
      const { admissionId, dischargeType = "NORMAL", force } = body;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const typeCfg = DISCHARGE_TYPES[dischargeType] || DISCHARGE_TYPES.NORMAL;

      // Billing gate: a NORMAL discharge for a CASH payer needs the bill paid
      // (balanceDue == 0). LAMA/ABSCONDED/EXPIRED/TRANSFER_OUT bypass; `force` overrides.
      if (typeCfg.requireClearances && !force) {
        const tariff = await db.patientTariff
          .findUnique({ where: { admissionId } })
          .catch(() => null);
        const payerType = tariff?.payerType || "CASH";
        if (payerType === "CASH") {
          const curBill = await getCurrentBill(
            ORGANIZATION_ID,
            admissionId,
          ).catch(() => null);
          const outstanding =
            Math.round((curBill?.balanceDue || 0) * 100) / 100;
          if (outstanding > 0) {
            return res.status(409).json({
              success: false,
              code: "IPD_BILLING_OUTSTANDING",
              error: `Cannot discharge: ₹${outstanding} outstanding on ${curBill?.billNumber || "the bill"}`,
              outstanding,
            });
          }
        }
      }

      const admission = await ownedAdmission(ORGANIZATION_ID, admissionId);
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      if (admission.status === "discharged")
        return res
          .status(409)
          .json({ success: false, error: "Already discharged" });

      const updated = await db.$transaction(async (tx) => {
        const upd = await tx.admission.update({
          where: { id: admissionId },
          data: {
            status: "discharged",
            admissionState: typeCfg.state,
            dischargeType,
            dischargeDate: new Date(),
            dischargeDiagnosis: body.dischargeDiagnosis ?? undefined,
            dischargeCondition: body.dischargeCondition ?? undefined,
            treatmentSummary: body.treatmentSummary ?? undefined,
            medicationsOnDischarge: body.medicationsOnDischarge ?? undefined,
            followUpInstructions: body.followUpInstructions ?? undefined,
            followUpDate: body.followUpDate
              ? new Date(body.followUpDate)
              : undefined,
            dischargeNotes: body.dischargeNotes ?? undefined,
          },
        });
        await tx.bedOccupancy.updateMany({
          where: { admissionId, endAt: null },
          data: { endAt: new Date() },
        });
        // Free the bed (housekeeping removed → straight to available).
        if (admission.bedId) {
          await tx.bed.update({
            where: { id: admission.bedId },
            data: { status: "available" },
          });
        }
        return upd;
      });

      await auditIpd(req, ORGANIZATION_ID, {
        action: "discharge",
        entityType: "ipd.admission",
        entityId: admissionId,
        before: { status: "admitted" },
        after: { status: "discharged", dischargeType, state: typeCfg.state },
      });

      // Freeze the bill at discharge (bed charges now use the discharge date).
      // Best-effort: never block a completed discharge if billing hiccups.
      let bill = null;
      try {
        bill = await finalizeBill(ORGANIZATION_ID, admissionId, {
          userId: req.user?.id,
        });
      } catch (e) {
        console.warn("bill finalize at discharge skipped:", e.message);
      }

      return res.json({ success: true, data: updated, bill });
    }

    // Phase 3: quick exit (LAMA / ABSCONDED / EXPIRED) — bypasses clearances
    if (resource === "mark-exit") {
      const { admissionId, dischargeType } = body;
      if (!admissionId || !dischargeType)
        return res
          .status(400)
          .json({
            success: false,
            error: "admissionId and dischargeType required",
          });
      const typeCfg = DISCHARGE_TYPES[dischargeType];
      if (!typeCfg)
        return res
          .status(400)
          .json({ success: false, error: "Invalid dischargeType" });
      const admission = await ownedAdmission(ORGANIZATION_ID, admissionId);
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      if (admission.status === "discharged")
        return res
          .status(409)
          .json({ success: false, error: "Already discharged" });
      const updated = await db.$transaction(async (tx) => {
        const upd = await tx.admission.update({
          where: { id: admissionId },
          data: {
            status: "discharged",
            admissionState: typeCfg.state,
            dischargeType,
            dischargeDate: new Date(),
            dischargeNotes: body.reason || `Marked ${dischargeType}`,
          },
        });
        await tx.bedOccupancy.updateMany({
          where: { admissionId, endAt: null },
          data: { endAt: new Date() },
        });
        // Free the bed (housekeeping removed → straight to available).
        if (admission.bedId) {
          await tx.bed.update({
            where: { id: admission.bedId },
            data: { status: "available" },
          });
        }
        return upd;
      });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "discharge",
        entityType: "ipd.admission",
        entityId: admissionId,
        before: { status: "admitted" },
        after: { status: "discharged", dischargeType, state: typeCfg.state },
      });
      return res.json({ success: true, data: updated });
    }

    // ── Phase 3A: Clinical Orders (CPOE) — SPINE ONLY (no billing, no executor) ──
    if (resource === "order") {
      const { admissionId } = body;
      if (!admissionId)
        return res
          .status(400)
          .json({ success: false, error: "admissionId required" });
      const adm = await ownedAdmission(ORGANIZATION_ID, admissionId, {
        id: true,
        patientId: true,
        status: true,
      });
      if (!adm)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      const actor = {
        id: req.user?.id || req.user?.userId || null,
        name: req.user?.fullName || null,
        role: req.user?.role || null,
      };
      try {
        const order = await createOrder(
          ORGANIZATION_ID,
          { ...body, patientId: body.patientId || adm.patientId },
          actor,
        );
        await auditIpd(req, ORGANIZATION_ID, {
          action: "create",
          entityType: "ipd.order",
          entityId: order.id,
          after: {
            admissionId,
            orderType: order.orderType,
            itemName: order.itemName,
            priority: order.priority,
          },
        });
        return res.status(201).json({ success: true, data: order });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    // Non-completing transitions (spine only — no billing).
    if (
      resource === "order-ack" ||
      resource === "order-start" ||
      resource === "order-cancel"
    ) {
      const action = {
        "order-ack": "ack",
        "order-start": "start",
        "order-cancel": "cancel",
      }[resource];
      if (!body.id)
        return res.status(400).json({ success: false, error: "id required" });
      const actor = {
        id: req.user?.id || req.user?.userId || null,
        name: req.user?.fullName || null,
        role: req.user?.role || null,
      };
      try {
        const { order, before } = await orderTransition(
          ORGANIZATION_ID,
          body.id,
          action,
          actor,
          { reason: body.reason },
        );
        const auditAction = {
          ack: "acknowledge",
          start: "start",
          cancel: "cancel",
        }[action];
        await auditIpd(req, ORGANIZATION_ID, {
          action: auditAction,
          entityType: "ipd.order",
          entityId: order.id,
          before: { status: before },
          after: {
            status: order.status,
            ...(action === "cancel" ? { reason: body.reason || null } : {}),
          },
        });
        return res.json({ success: true, data: order });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    // Completion (Phase 3B: PROCEDURE auto-bills via the existing tariff→IpdCharge flow).
    if (resource === "order-complete") {
      if (!body.id)
        return res.status(400).json({ success: false, error: "id required" });
      const actor = {
        id: req.user?.id || req.user?.userId || null,
        name: req.user?.fullName || null,
        role: req.user?.role || null,
      };
      // Discipline-scoped completion (gate 2 — in addition to ipdAllowed above).
      const existing = await db.clinicalOrder.findFirst({
        where: { id: body.id, organizationId: ORGANIZATION_ID },
        select: { orderType: true },
      });
      if (!existing)
        return res
          .status(404)
          .json({
            success: false,
            code: "IPD_ORDER_NOT_FOUND",
            error: "Order not found",
          });
      if (!orderAllowed(req, existing.orderType))
        return res
          .status(403)
          .json({
            success: false,
            code: "FORBIDDEN",
            error: `Your role may not complete a ${existing.orderType} order`,
          });
      try {
        // Only PROCEDURE auto-bills in 3B; other types remain spine-only (biller=null).
        const biller =
          existing.orderType === "PROCEDURE"
            ? (tx, order) =>
                billProcedureOrder(tx, ORGANIZATION_ID, order, actor)
            : null;
        const { order, before, charge, deduped } = await completeOrder(
          ORGANIZATION_ID,
          body.id,
          actor,
          { biller },
        );
        await auditIpd(req, ORGANIZATION_ID, {
          action: "complete",
          entityType: "ipd.order",
          entityId: order.id,
          before: { status: before },
          after: {
            status: order.status,
            billed: order.billed,
            ipdChargeId: order.ipdChargeId || null,
          },
        });
        if (charge && !deduped) {
          await auditIpd(req, ORGANIZATION_ID, {
            action: "charge",
            entityType: "ipd.charge",
            entityId: charge.id,
            after: {
              admissionId: order.admissionId,
              description: charge.description,
              unitPrice: charge.unitPrice,
              quantity: charge.quantity,
              serviceGroup: charge.serviceGroup,
              sourceModule: "PROCEDURE",
              sourceRef: order.id,
            },
          });
        }
        return res.json({
          success: true,
          data: order,
          charge: charge || undefined,
        });
      } catch (e) {
        return res
          .status(e.status || 500)
          .json({ success: false, code: e.code, error: e.message });
      }
    }

    return res
      .status(400)
      .json({
        error:
          "Invalid resource. Use: ward, bed, admission, note, billing, charge, sync-beds, transfer, post-charge, vitals, note-v2, medication-administration, discharge-finalize, mark-exit, order, order-ack, order-start, order-complete, order-cancel",
      });
  } catch (err) {
    console.error("inpatient create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function update(req, res) {
  try {
    const ORGANIZATION_ID =
      req.organizationId || process.env.ORGANIZATION_ID || "org-demo";
    const resource = req.body.resource || req.query.resource;
    const id = req.body.id || req.query.id;

    // Support both nested updates object and flat body fields
    const {
      resource: _r,
      id: _i,
      updates: nestedUpdates,
      dailyRoomRate,
      ...flatBody
    } = req.body;
    const updates = nestedUpdates || flatBody;

    if (!ipdAllowed(req, resource)) {
      return res
        .status(403)
        .json({
          success: false,
          code: "FORBIDDEN",
          error: `Your role may not perform this IPD action (${resource})`,
        });
    }

    // ── ipd-consultation PATCH ─────────────────────────────────────────────────
    if (resource === "ipd-consultation") {
      const consult = await db.ipdConsultation.findFirst({
        where: { id, organizationId: ORGANIZATION_ID },
      });
      if (!consult)
        return res.status(404).json({ success: false, error: "Consultation not found" });
      if (["BILLED", "CANCELLED"].includes(consult.status))
        return res.status(409).json({ success: false, error: `Consultation is already ${consult.status.toLowerCase()}` });

      const newStatus         = req.body.status || updates.status;
      const consultationNotes = req.body.consultationNotes || updates.consultationNotes;
      const diagnosis         = req.body.diagnosis || updates.diagnosis;
      const recommendedPlan   = req.body.recommendedPlan || updates.recommendedPlan;
      const followUpNotes     = req.body.followUpNotes || updates.followUpNotes;
      const followUpRequired  = req.body.followUpRequired ?? updates.followUpRequired;

      const VALID = ["REQUESTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
      if (newStatus && !VALID.includes(newStatus))
        return res.status(400).json({ success: false, error: `Invalid status. Use: ${VALID.join(", ")}` });

      // COMPLETE → auto-bill in a transaction
      if (newStatus === "COMPLETED") {
        if (consult.ipdChargeId)
          return res.status(409).json({ success: false, error: "Already billed" });

        const completedAt = new Date();
        // Inline update then bill inside a transaction
        const result = await db.$transaction(async (tx) => {
          const updated = await tx.ipdConsultation.update({
            where: { id },
            data: {
              status: "COMPLETED",
              completedAt,
              ...(consultationNotes !== undefined && { consultationNotes }),
              ...(diagnosis         !== undefined && { diagnosis }),
              ...(recommendedPlan   !== undefined && { recommendedPlan }),
              ...(followUpNotes     !== undefined && { followUpNotes }),
              ...(followUpRequired  !== undefined && { followUpRequired: Boolean(followUpRequired) }),
            },
          });
          const { charge, commission } = await billConsultation(
            tx, ORGANIZATION_ID,
            { ...updated, completedAt },
            { id: req.user?.id, name: req.user?.fullName || req.user?.name },
          );
          return { updated, charge, commission };
        });

        await auditIpd(req, ORGANIZATION_ID, {
          action: "complete", entityType: "ipd.consultation", entityId: id,
          newValues: { status: "BILLED", chargeId: result.charge?.id },
        });

        // Re-fetch with relations for the response
        const fresh = await db.ipdConsultation.findUnique({
          where: { id },
          include: {
            consultingDoctor: { select: { id: true, fullName: true } },
            department:       { select: { id: true, name: true } },
            ipdCharge:        { select: { id: true, lineTotal: true } },
          },
        });
        return res.json({ success: true, data: fresh, charge: result.charge, commission: result.commission });
      }

      // Simple status transitions (REQUESTED → IN_PROGRESS, or CANCELLED)
      const updated = await db.ipdConsultation.update({
        where: { id },
        data: {
          ...(newStatus !== undefined && { status: newStatus }),
          ...(consultationNotes !== undefined && { consultationNotes }),
          ...(diagnosis         !== undefined && { diagnosis }),
          ...(recommendedPlan   !== undefined && { recommendedPlan }),
          ...(followUpNotes     !== undefined && { followUpNotes }),
          ...(followUpRequired  !== undefined && { followUpRequired: Boolean(followUpRequired) }),
        },
      });
      return res.json({ success: true, data: updated });
    }

    if (resource === "admission") {
      // Whitelisted, org-scoped update — NO status/billing/org mass-assignment.
      const admission = await ownedAdmission(ORGANIZATION_ID, id);
      if (!admission)
        return res
          .status(404)
          .json({ success: false, error: "Admission not found" });
      const data = pick(updates, ADMISSION_UPDATABLE);
      if (data.expectedLengthOfStay !== undefined)
        data.expectedLengthOfStay = parseInt(data.expectedLengthOfStay) || null;
      const updated = await db.admission.update({ where: { id }, data });
      return res.json({ success: true, data: updated });
    }

    if (resource === "bed") {
      const bed = await ownedBed(ORGANIZATION_ID, id);
      if (!bed)
        return res.status(404).json({ success: false, error: "Bed not found" });
      const data = pick(updates, BED_UPDATABLE);
      const updated = await db.bed.update({ where: { id }, data });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "update",
        entityType: "ipd.bed",
        entityId: id,
        before: { status: bed.status },
        after: data,
      });
      return res.json({ success: true, data: updated });
    }

    if (resource === "ward") {
      if (!(await ownedWard(ORGANIZATION_ID, id)))
        return res
          .status(404)
          .json({ success: false, error: "Ward not found" });
      const {
        name,
        code,
        type,
        capacity,
        building,
        floor,
        chargeNurse,
        phone,
        departmentId,
      } = updates;
      const wardData = {};
      if (name !== undefined) wardData.name = name;
      if (code !== undefined) wardData.code = code;
      if (type !== undefined) wardData.type = type;
      if (capacity !== undefined) wardData.capacity = parseInt(capacity) || 0;
      if (building !== undefined) wardData.building = building;
      if (floor !== undefined) wardData.floor = floor;
      if (departmentId !== undefined)
        wardData.departmentId = departmentId || null;
      if (chargeNurse !== undefined) wardData.chargeNurse = chargeNurse;
      if (phone !== undefined) wardData.phone = phone;

      const updated = await db.ward.update({
        where: { id },
        data: wardData,
        include: { beds: true },
      });

      if (wardData.capacity !== undefined) {
        const target = parseInt(wardData.capacity) || 0;
        const existing = updated.beds || [];
        if (target > existing.length) {
          const start = existing.length + 1;
          await db.bed.createMany({
            data: Array.from({ length: target - existing.length }, (_, i) => ({
              organizationId: ORGANIZATION_ID,
              wardId: id,
              bedNumber: String(start + i),
              type: "Standard",
              status: "available",
            })),
          });
        }
      }

      const wardWithBeds = await db.ward.findUnique({
        where: { id },
        include: { beds: { orderBy: { bedNumber: "asc" } } },
      });

      return res.json({ success: true, data: wardWithBeds });
    }

    // (removed) PATCH resource=generate-bill — legacy bed-day biller; replaced by
    // resource=bill-finalize (Bill/IpdCharge). Had zero callers. Deleted 2026-06-15.

    // Vitals correction (nurse-only via RBAC). Audited before/after; NEWS2 recomputed.
    if (resource === "vitals") {
      const existing = await db.vitalsRecord.findFirst({
        where: { id, organizationId: ORGANIZATION_ID },
      });
      if (!existing)
        return res
          .status(404)
          .json({ success: false, error: "Vitals record not found" });
      const num = (value) => {
        const isEmptyValue =
          value === "" || value === undefined || value === null;

        if (isEmptyValue) {
          return null;
        }

        return Number(value);
      };
      const VITAL_FIELDS = [
        "systolicBp",
        "diastolicBp",
        "heartRate",
        "respiratoryRate",
        "spo2",
        "tempC",
        "painScore",
        "gcs",
        "intakeMl",
        "outputMl",
        "bloodSugar",
      ];
      const data = {};
      for (const k of VITAL_FIELDS)
        if (updates[k] !== undefined) data[k] = num(updates[k]);
      if (updates.consciousness !== undefined)
        data.consciousness = updates.consciousness || null;
      if (updates.notes !== undefined) data.notes = updates.notes || null;
      // Recompute NEWS2 from the merged (old + new) values.
      const merged = { ...existing, ...data };
      const news = computeNews2(merged);
      data.newsScore = news.score;
      data.newsRisk = news.risk;
      const updated = await db.vitalsRecord.update({ where: { id }, data });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "update",
        entityType: "ipd.vitals",
        entityId: id,
        before: {
          systolicBp: existing.systolicBp,
          heartRate: existing.heartRate,
          spo2: existing.spo2,
          tempC: existing.tempC,
          newsScore: existing.newsScore,
        },
        after: { ...data },
      });
      return res.json({ success: true, data: updated });
    }

    // Phase 3: progress a housekeeping task (drives bed turnover)
    return res
      .status(400)
      .json({
        error:
          "Invalid resource. Use: admission, bed, ward, vitals",
      });
  } catch (err) {
    console.error("inpatient update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function remove(req, res) {
  try {
    const ORGANIZATION_ID =
      req.organizationId || process.env.ORGANIZATION_ID || "org-demo";
    const resource = req.body.resource || req.query.resource;
    const id = req.body.id || req.query.id;

    if (!ipdAllowed(req, resource)) {
      return res
        .status(403)
        .json({
          success: false,
          code: "FORBIDDEN",
          error: `Your role may not perform this IPD action (${resource})`,
        });
    }

    if (resource === "ward") {
      if (!(await ownedWard(ORGANIZATION_ID, id)))
        return res.status(404).json({ error: "Ward not found" });
      const activeAdmissions = await db.admission.count({
        where: {
          organizationId: ORGANIZATION_ID,
          status: "admitted",
          bed: { wardId: id },
        },
      });

      if (activeAdmissions > 0) {
        return res.status(400).json({
          error: "Cannot delete ward with active admissions",
        });
      }

      await db.$transaction([
        db.bed.deleteMany({
          where: { wardId: id, organizationId: ORGANIZATION_ID },
        }),
        db.ward.delete({ where: { id } }),
      ]);
      await auditIpd(req, ORGANIZATION_ID, {
        action: "delete",
        entityType: "ipd.ward",
        entityId: id,
      });

      return res.json({ success: true });
    }

    if (resource === "bed") {
      const bed = await ownedBed(ORGANIZATION_ID, id);
      if (!bed) return res.status(404).json({ error: "Bed not found" });
      if (bed.status === "occupied")
        return res.status(400).json({ error: "Cannot delete an occupied bed" });
      await db.bed.delete({ where: { id } });
      await auditIpd(req, ORGANIZATION_ID, {
        action: "delete",
        entityType: "ipd.bed",
        entityId: id,
      });

      return res.json({ success: true });
    }

    // ── ipd-consultation DELETE (cancel) ──────────────────────────────────────
    if (resource === "ipd-consultation") {
      const consult = await db.ipdConsultation.findFirst({
        where: { id, organizationId: ORGANIZATION_ID },
      });
      if (!consult)
        return res.status(404).json({ success: false, error: "Consultation not found" });
      if (["BILLED", "CANCELLED"].includes(consult.status))
        return res.status(409).json({ success: false, error: `Cannot cancel a ${consult.status.toLowerCase()} consultation` });

      await db.ipdConsultation.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Invalid resource. Use: ward, bed, ipd-consultation" });
  } catch (err) {
    console.error("inpatient remove error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
