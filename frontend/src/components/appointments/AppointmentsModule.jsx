import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useOrgSettings } from "@/lib/useOrgSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Plus,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Phone,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  UserCheck,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Bell,
  BellOff,
  FileText,
  Printer,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
} from "date-fns";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import client from "@/api/client";
import PatientLookup from "@/components/common/PatientLookup";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { drName } from "@/lib/utils";
import { appointmentSchema, editAppointmentSchema } from "./appointmentSchema";
import {
  TIME_SLOTS,
  DURATION_OPTIONS,
  APPOINTMENTS_LIST_PER_PAGE,
  STATUS_CONFIG,
  APPOINTMENT_TYPE_CONFIG,
} from "./appointmentConstants";
import { printAppointmentCard } from "./appointmentPrint";

const parseDate = (date) => (date instanceof Date ? date : new Date(date));

const getPatientFullName = (patient) => {
  if (!patient) return "Unknown Patient";
  return `${patient.firstName} ${patient.middleName || ""} ${patient.lastName}`.trim();
};

const calculateAge = (dob) => {
  const today = new Date();
  const birthDate = parseDate(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  )
    age--;
  return age;
};

// Fetch EVERY page of a paginated endpoint, so large datasets are never
// silently truncated. Advances by the number of rows actually returned, so it
// stays correct even if the server caps the page size.
async function fetchAllPages(path, pageSize = 1000) {
  const sep = path.includes("?") ? "&" : "?";
  let offset = 0;
  let all = [];
  let total = Infinity;
  while (all.length < total) {
    const res = await client.get(`${path}${sep}limit=${pageSize}&offset=${offset}`);
    const batch = res.data ?? [];
    all = all.concat(batch);
    total = res.meta?.total ?? all.length;
    if (batch.length === 0) break; // no more rows (safety)
    offset += batch.length; // advance by what we actually received
    if (offset > 100000) break; // hard stop — never loop forever
  }
  return all;
}

export default function AppointmentsModule() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [orgInfo, setOrgInfo] = useState({
    name: "Hospital",
    address: "",
    city: "",
    phone: "",
    email: "",
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all"); // department NAME or 'all'
  // Only one dialog is ever open — a single value prevents invalid states.
  const [activeDialog, setActiveDialog] = useState(null); // 'new' | 'cancel' | 'reschedule' | 'edit' | null
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Dashboard "Book Appointment" deep-links here with ?action=new → auto-open the dialog.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setActiveDialog("new");
      searchParams.delete("action"); // clean URL so back/refresh doesn't re-open
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingAppointment, setEditingAppointment] = useState(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const isEditSubmittingRef = useRef(false);

  const [selectedAptIds, setSelectedAptIds] = useState(new Set());
  const [appointmentsListPage, setAppointmentsListPage] = useState(1);

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [opdServices, setOpdServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [patientsResult, appointmentsResult, usersResult, departmentsResult, servicesResult] =
      await Promise.allSettled([
        fetchAllPages("/patients?status=active"),
        fetchAllPages("/appointments"),
        client.get("/settings?resource=users"),
        client.get("/settings?resource=departments"),
        client.get("/settings?resource=billingServices"),
      ]);
    if (patientsResult.status === "fulfilled")
      setPatients(patientsResult.value ?? []);
    if (appointmentsResult.status === "fulfilled")
      setAppointments(appointmentsResult.value ?? []);
    if (usersResult.status === "fulfilled")
      setUsers(usersResult.value?.data ?? []);
    if (departmentsResult.status === "fulfilled")
      setDepartments(departmentsResult.value?.data ?? []);
    if (servicesResult.status === "fulfilled") {
      const svc = servicesResult.value?.data;
      setOpdServices(Array.isArray(svc) ? svc : []);
    }
    const firstErr = [patientsResult, appointmentsResult, usersResult].find(
      (r) => r.status === "rejected",
    );
    if (firstErr)
      setError(
        firstErr.reason instanceof Error
          ? firstErr.reason.message
          : "Some data failed to load",
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const { orgInfo: hookOrgInfo } = useOrgSettings();
  useEffect(() => {
    setOrgInfo(hookOrgInfo);
  }, [hookOrgInfo]);
  useEffect(() => {
    setAppointmentsListPage(1);
  }, [selectedDate, statusFilter, doctorFilter, deptFilter, searchQuery]);

  // No second fetch on dialog open — patients and users are already loaded on mount

  const doctors = useMemo(
    () => users.filter((u) => u.role === "doctor" && u.isActive),
    [users],
  );

  // O(1) Map lookup instead of O(n) array scan on every render
  const patientsMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );
  const getPatient = useCallback(
    (patientId) => patientsMap.get(patientId) ?? null,
    [patientsMap],
  );
  const getDoctor = useCallback(
    (doctorId) => doctors.find((d) => d.id === doctorId),
    [doctors],
  );

  const createAppointment = useCallback(async (data) => {
    const res = await client.post("/appointments", data);
    const appointment = res.data;
    setAppointments((prev) => [...prev, appointment]);
    return appointment;
  }, []);

  const updateAppointment = useCallback(async (id, updates) => {
    const res = await client.patch(`/appointments/${id}`, updates);
    const appointment = res.data;
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...appointment } : a)),
    );
    return appointment;
  }, []);

  const form = useForm({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      departmentId: "",
      doctorId: "",
      appointmentDate: new Date(),
      appointmentTime: "",
      appointmentType: "new_patient",
      priority: "normal",
      consultationFee: "",
      notes: "",
    },
  });

  const editForm = useForm({
    resolver: zodResolver(editAppointmentSchema),
    defaultValues: {
      doctorId: "",
      appointmentDate: new Date(),
      appointmentTime: "",
      appointmentType: "new_patient",
      priority: "normal",
      status: "scheduled",
      chiefComplaint: "",
      notes: "",
    },
  });

  // Ask the backend what this visit will cost: it detects New vs Follow-up from the
  // patient's history with this doctor, applies the doctor's day-based fee slabs, and
  // resets to "New Patient" after 30 days. This is the SAME logic the booking endpoint
  // uses, so the preview always matches the charge.
  const watchDoctorId = form.watch("doctorId");
  const watchPatientId = form.watch("patientId");
  const watchDate = form.watch("appointmentDate");
  const [feeCalc, setFeeCalc] = useState(null);
  const [feeCalcLoading, setFeeCalcLoading] = useState(false);

  useEffect(() => {
    if (!watchDoctorId || !watchPatientId || !watchDate) {
      setFeeCalc(null);
      return;
    }
    let cancelled = false;
    setFeeCalcLoading(true);
    const apptDate = parseDate(watchDate);
    client
      .get(
        `/fee-slabs/calculate?doctorId=${watchDoctorId}&patientId=${watchPatientId}&date=${apptDate.toISOString()}`,
      )
      .then((res) => {
        if (cancelled || !res?.success) return;
        const calc = res.data;
        setFeeCalc(calc);
        // Auto-flag the visit type (don't override a manual "emergency" choice)
        const current = form.getValues("appointmentType");
        if (current !== "emergency") {
          form.setValue(
            "appointmentType",
            calc.isNewPatient ? "new_patient" : "follow_up",
          );
        }
        // Reflect the fee that will actually be charged
        form.setValue("consultationFee", String(calc.fee));
      })
      .catch(() => {
        if (!cancelled) setFeeCalc(null);
      })
      .finally(() => {
        if (!cancelled) setFeeCalcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [watchDoctorId, watchPatientId, watchDate, form]);

  // The DB has the same department name seeded several times (e.g. 5× "Cardiology").
  // Collapse them to one entry per name so the dropdown isn't full of duplicates.
  const uniqueDepartments = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const d of departments) {
      const key = (d.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    return out;
  }, [departments]);

  // doctorId → department name (works across the duplicate department copies)
  const doctorDeptName = useMemo(() => {
    const m = new Map();
    for (const d of doctors) m.set(d.id, (d.department?.name || "").trim());
    return m;
  }, [doctors]);

  // Doctor filter dropdown: only doctors who actually have appointments, so the
  // list isn't cluttered with the many unused seeded doctor records.
  const filterDoctors = useMemo(() => {
    const ids = new Set(appointments.map((a) => a.doctorId));
    return doctors.filter((d) => ids.has(d.id));
  }, [appointments, doctors]);

  // Doctors for the appointment form: filtered by the selected department's NAME
  // (so a doctor in any "Cardiology" copy shows), then de-duplicated for display.
  const watchDept = form.watch("departmentId");
  const availableDoctors = useMemo(() => {
    let list = doctors;
    if (watchDept) {
      const selName = (departments.find((d) => d.id === watchDept)?.name || "")
        .trim()
        .toLowerCase();
      list = doctors.filter(
        (d) => (d.department?.name || "").trim().toLowerCase() === selName,
      );
    }
    const seen = new Set();
    return list.filter((d) => {
      const key = `${(d.fullName || "").trim().toLowerCase()}|${(d.specialization || "").trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [watchDept, doctors, departments]);

  const stats = useMemo(() => {
    const todayApts = appointments.filter((a) =>
      isSameDay(parseDate(a.appointmentDate), new Date()),
    );
    return {
      total: todayApts.length,
      scheduled: todayApts.filter((a) => a.status === "scheduled").length,
      checkedIn: todayApts.filter((a) => a.status === "checked_in").length,
      inProgress: todayApts.filter((a) => a.status === "in_progress").length,
      completed: todayApts.filter((a) => a.status === "completed").length,
      cancelled: todayApts.filter((a) => a.status === "cancelled").length,
      noShows: todayApts.filter((a) => a.status === "no_show").length,
      confirmed: todayApts.filter((a) => a.status === "confirmed").length,
    };
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (
        activeTab === "list" &&
        !isSameDay(parseDate(apt.appointmentDate), selectedDate)
      )
        return false;
      if (statusFilter !== "all" && apt.status !== statusFilter) return false;
      if (doctorFilter !== "all" && apt.doctorId !== doctorFilter) return false;
      if (
        deptFilter !== "all" &&
        (doctorDeptName.get(apt.doctorId) || "").toLowerCase() !==
          deptFilter.toLowerCase()
      )
        return false;
      if (searchQuery) {
        const patient = getPatient(apt.patientId);
        const doctor = getDoctor(apt.doctorId);
        const q = searchQuery.toLowerCase();
        return (
          patient?.firstName.toLowerCase().includes(q) ||
          patient?.lastName.toLowerCase().includes(q) ||
          patient?.mrn.toLowerCase().includes(q) ||
          doctor?.fullName.toLowerCase().includes(q) ||
          apt.chiefComplaint?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    appointments,
    selectedDate,
    statusFilter,
    doctorFilter,
    deptFilter,
    doctorDeptName,
    searchQuery,
    activeTab,
    getPatient,
    getDoctor,
  ]);

  const getAppointmentsForDate = useCallback(
    (date) =>
      appointments.filter((apt) =>
        isSameDay(parseDate(apt.appointmentDate), date),
      ),
    [appointments],
  );

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // ── Action handlers ──

  const handleCheckIn = async (apt) => {
    try {
      await updateAppointment(apt.id, { status: "checked_in" });
      toast.success("Patient checked in successfully");
    } catch {
      toast.error("Failed to check in patient");
    }
  };

  const handleStartConsultation = async (apt) => {
    try {
      await updateAppointment(apt.id, { status: "in_progress" });
      toast.success("Consultation started");
    } catch {
      toast.error("Failed to start consultation");
    }
  };

  
  const handleComplete = async (apt) => {
    try {
      await updateAppointment(apt.id, { status: "completed" });
      toast.success("Appointment completed");
    } catch {
      toast.error("Failed to complete appointment");
    }
  };

  const handleConfirm = async (apt) => {
    try {
      await updateAppointment(apt.id, { status: "confirmed" });
      toast.success("Appointment confirmed");
    } catch {
      toast.error("Failed to confirm appointment");
    }
  };

  const handleNoShow = async (apt) => {
    try {
      await updateAppointment(apt.id, { status: "no_show" });
      toast.success("Marked as no-show");
    } catch {
      toast.error("Failed to mark as no-show");
    }
  };

  const handleCancel = async () => {
    if (!selectedAppointment || !cancellationReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }
    try {
      setIsSubmitting(true);
      await updateAppointment(selectedAppointment.id, {
        status: "cancelled",
        cancellationReason,
      });
      setActiveDialog(null);
      setSelectedAppointment(null);
      setCancellationReason("");
      toast.success("Appointment cancelled");
    } catch {
      toast.error("Failed to cancel appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) {
      toast.error("Please select date and time");
      return;
    }
    try {
      setIsSubmitting(true);
      await createAppointment({
        patientId: selectedAppointment.patientId,
        doctorId: selectedAppointment.doctorId,
        appointmentDate: rescheduleDate.toISOString(),
        appointmentTime: rescheduleTime,
        appointmentType: selectedAppointment.appointmentType || "new_patient",
        chiefComplaint: selectedAppointment.chiefComplaint,
        notes: selectedAppointment.notes,
      });
      await updateAppointment(selectedAppointment.id, {
        status: "rescheduled",
      });
      setActiveDialog(null);
      setSelectedAppointment(null);
      setRescheduleDate(null);
      setRescheduleTime("");
      toast.success("Appointment rescheduled");
    } catch {
      toast.error("Failed to reschedule appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (apt) => {
    setEditingAppointment(apt);
    editForm.reset({
      doctorId: apt.doctorId || "",
      appointmentDate: parseDate(apt.appointmentDate),
      appointmentTime: apt.appointmentTime,
      appointmentType: apt.appointmentType || "new_patient",
      priority: "normal",
      status: apt.status,
      chiefComplaint: apt.chiefComplaint || "",
      notes: apt.notes || "",
    });
    setActiveDialog("edit");
  };

  const handleEditSubmit = async (data) => {
    if (!editingAppointment || isEditSubmittingRef.current) return;
    isEditSubmittingRef.current = true;
    setIsEditSubmitting(true);
    try {
      await updateAppointment(editingAppointment.id, {
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate.toISOString(),
        appointmentTime: data.appointmentTime,
        appointmentType: data.appointmentType,
        chiefComplaint: data.chiefComplaint,
        notes: data.notes,
        status: data.status,
      });
      setActiveDialog(null);
      setEditingAppointment(null);
      toast.success("Appointment updated successfully");
    } catch {
      toast.error("Failed to update appointment");
    } finally {
      setIsEditSubmitting(false);
      isEditSubmittingRef.current = false;
    }
  };

  const toggleAptSelection = (id) => {
    setSelectedAptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllApts = () => {
    if (selectedAptIds.size === filteredAppointments.length)
      setSelectedAptIds(new Set());
    else setSelectedAptIds(new Set(filteredAppointments.map((a) => a.id)));
  };

  const handleBulkStatusUpdate = async (status) => {
    const count = selectedAptIds.size;
    if (count === 0) return;
    try {
      await Promise.all(
        [...selectedAptIds].map((id) => updateAppointment(id, { status })),
      );
      setSelectedAptIds(new Set());
      toast.success(
        `${count} appointment${count > 1 ? "s" : ""} marked as ${status.replace("_", " ")}`,
      );
    } catch {
      toast.error("Failed to update some appointments");
    }
  };

  const handleSendReminder = async (apt) => {
    try {
      const patient = apt.patient || getPatient(apt.patientId);
      const phone = patient?.phonePrimary?.replace(/[^0-9]/g, "") || "";
      const patientName = patient
        ? `${patient.firstName} ${patient.lastName}`.trim()
        : "Patient";
      const aptDate = apt.appointmentDate
        ? format(new Date(apt.appointmentDate), "dd MMM yyyy")
        : "";
      const doctorName =
        apt.doctor?.fullName || getDoctor(apt.doctorId)?.fullName || "Doctor";
      const message = `Dear ${patientName}, your appointment with ${drName(doctorName)} is confirmed on ${aptDate} at ${apt.appointmentTime}. Please arrive 10 minutes early. ${orgInfo.name}.`;
      if (phone)
        window.open(
          `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`,
          "_blank",
        );
      await updateAppointment(apt.id, { reminderSent: true });
      toast.success(`WhatsApp reminder opened for ${patientName}`);
    } catch {
      toast.error("Failed to send reminder");
    }
  };

  const handlePrintAppointmentCard = (apt) =>
    printAppointmentCard(apt, orgInfo);

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      const patient = getPatient(data.patientId);
      const result = await createAppointment({
        patientId: data.patientId,
        doctorId: data.doctorId,
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        appointmentDate: data.appointmentDate.toISOString(),
        appointmentTime: data.appointmentTime,
        appointmentType: data.appointmentType,
        notes: data.notes,
        priority: data.priority,
        // Fee is decided by the doctor on the backend — not sent from the form
      });
      setActiveDialog(null);
      setSelectedPatient(null);
      form.reset();
      const patientName = getPatientFullName(patient || null);
      if (result?.draftInvoiceNumber) {
        toast.success(`Appointment booked for ${patientName}`, {
          description: `Draft invoice ${result.draftInvoiceNumber} created — go to Billing to review`,
          duration: 6000,
        });
      } else {
        toast.success(`Appointment created for ${patientName}`);
      }
    } catch {
      toast.error("Failed to create appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Failed to load appointments data</p>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-blue-600" />
            Appointments
          </h1>
          <p className="text-gray-500">
            Schedule and manage patient appointments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print Schedule
          </Button>
          <Dialog
            open={activeDialog === "new"}
            onOpenChange={(open) => {
              setActiveDialog(open ? "new" : null);
              if (!open) {
                setSelectedPatient(null);
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Appointment</DialogTitle>
                <DialogDescription>
                  Schedule a new appointment for a patient
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* Patient Selection — search database by UHID / name */}
                  <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient *</FormLabel>
                        <PatientLookup
                          selectedPatient={selectedPatient}
                          onSelect={(patient) => {
                            setSelectedPatient(patient);
                            field.onChange(patient.id);
                            setPatients((prev) => {
                              if (prev.some((p) => p.id === patient.id))
                                return prev;
                              return [patient, ...prev];
                            });
                          }}
                          onClear={() => {
                            setSelectedPatient(null);
                            field.onChange("");
                          }}
                          placeholder="Search by UHID, name, or phone..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Department & Doctor — pick a department to narrow the doctor list */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Department</FormLabel>
                          <SearchableSelect
                            className="w-full"
                            options={uniqueDepartments.map((d) => ({
                              value: d.id,
                              label: d.name,
                            }))}
                            value={field.value}
                            onChange={(value) => {
                              field.onChange(value);
                              // Reset doctor + fee since the doctor list just changed
                              form.setValue("doctorId", "");
                              form.setValue("consultationFee", "");
                            }}
                            placeholder="All departments"
                            searchPlaceholder="Search departments..."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="doctorId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Doctor *</FormLabel>
                          <SearchableSelect
                            className="w-full"
                            options={availableDoctors.map((d) => ({
                              value: d.id,
                              label: `${d.fullName}${d.consultationFee != null ? ` (₹${d.consultationFee})` : ""}`,
                              sublabel: d.specialization || undefined,
                            }))}
                            value={field.value}
                            onChange={(value) => {
                              field.onChange(value);
                              // Prefill fee from the doctor's configured consultation fee
                              const doc = doctors.find((d) => d.id === value);
                              form.setValue(
                                "consultationFee",
                                doc?.consultationFee != null
                                  ? String(doc.consultationFee)
                                  : "",
                              );
                            }}
                            placeholder={
                              availableDoctors.length === 0
                                ? "No doctors in department"
                                : "Select doctor"
                            }
                            searchPlaceholder="Search doctors..."
                            emptyText="No doctors found"
                            disabled={availableDoctors.length === 0}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>


                  {/* Charge Amount — decided by the doctor's fee slabs on the backend (read-only) */}
                  <FormField
                    control={form.control}
                    name="consultationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Charge Amount (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            readOnly
                            tabIndex={-1}
                            placeholder="Select a doctor"
                            className="bg-gray-100 cursor-not-allowed text-gray-700"
                            {...field}
                          />
                        </FormControl>
                        {feeCalcLoading ? (
                          <p className="text-xs text-gray-400 mt-1">
                            Calculating fee…
                          </p>
                        ) : feeCalc ? (
                          feeCalc.isNewPatient ? (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              🆕 New Patient — base consultation fee
                              {feeCalc.daysSinceLastVisit != null
                                ? ` (last visit ${feeCalc.daysSinceLastVisit} days ago, beyond 30-day window)`
                                : ""}
                              .
                            </p>
                          ) : feeCalc.fee === 0 ? (
                            <p className="text-xs text-green-600 font-medium mt-1">
                              ✓ Free follow-up — {feeCalc.daysSinceLastVisit} day(s)
                              since last visit. No charge.
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 font-medium mt-1">
                              ↩ Follow-up — {feeCalc.daysSinceLastVisit} day(s) since
                              last visit
                              {feeCalc.appliedSlab?.fromDays != null
                                ? `, slab ${feeCalc.appliedSlab.fromDays}–${feeCalc.appliedSlab.toDays} days`
                                : ""}
                              .
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Set automatically from the doctor's fee structure.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="appointmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={
                                field.value
                                  ? format(field.value, "yyyy-MM-dd")
                                  : ""
                              }
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? new Date(e.target.value)
                                    : null,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="appointmentTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIME_SLOTS.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>



                  {/* Type & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="appointmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appointment Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="new_patient">
                                New Patient
                              </SelectItem>
                              <SelectItem value="follow_up">
                                Follow-up
                              </SelectItem>
                              <SelectItem value="emergency">
                                Emergency
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {feeCalc && (
                            <p className="text-xs text-gray-400 mt-1">
                              Auto-detected from patient history — change if needed.
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Additional Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional notes or instructions..."
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveDialog(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Create Appointment
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          {
            label: "Today's Total",
            val: stats.total,
            color: "blue",
            Icon: CalendarDays,
          },
          {
            label: "Confirmed",
            val: stats.confirmed,
            color: "indigo",
            Icon: CheckCircle,
          },
          {
            label: "Checked In",
            val: stats.checkedIn,
            color: "green",
            Icon: UserCheck,
          },
          {
            label: "In Progress",
            val: stats.inProgress,
            color: "orange",
            Icon: Play,
          },
          {
            label: "Completed",
            val: stats.completed,
            color: "gray",
            Icon: CheckCircle,
          },
          {
            label: "Cancelled",
            val: stats.cancelled,
            color: "red",
            Icon: XCircle,
          },
          {
            label: "No Shows",
            val: stats.noShows,
            color: "amber",
            Icon: AlertCircle,
          },
        ].map(({ label, val, color, Icon }) => (
          <Card key={label} className={`bg-${color}-50 border-${color}-200`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm text-${color}-600 font-medium`}>
                    {label}
                  </p>
                  <p className={`text-2xl font-bold text-${color}-700`}>
                    {val}
                  </p>
                </div>
                <Icon className={`h-8 w-8 text-${color}-400`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="calendar">Monthly</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="doctor-slots">Doctor Slots</TabsTrigger>
        </TabsList>

        {/* ── Monthly Calendar ── */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentMonth(subMonths(currentMonth, 1))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentMonth(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentMonth(addMonths(currentMonth, 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-center text-sm font-medium text-gray-500 py-2"
                      >
                        {day}
                      </div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {monthDays.map((day) => {
                    const dayApts = getAppointmentsForDate(day);
                    const isSelected = isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);
                    return (
                      <Button
                        key={day.toISOString()}
                        variant={isSelected ? "default" : "ghost"}
                        className={`h-auto aspect-square flex flex-col items-center p-1 relative ${isTodayDate && !isSelected ? "ring-2 ring-blue-400" : ""}`}
                        onClick={() => setSelectedDate(day)}
                      >
                        <span className="text-sm">{format(day, "d")}</span>
                        {dayApts.length > 0 && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {dayApts.slice(0, 3).map((apt, idx) => (
                              <div
                                key={idx}
                                className={`h-1.5 w-1.5 rounded-full ${apt.status === "completed" ? "bg-gray-400" : apt.status === "cancelled" ? "bg-red-400" : apt.status === "in_progress" ? "bg-orange-400" : "bg-blue-400"}`}
                              />
                            ))}
                            {dayApts.length > 3 && (
                              <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                            )}
                          </div>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected day details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {isToday(selectedDate)
                    ? "Today"
                    : format(selectedDate, "EEEE, MMM d")}
                </CardTitle>
                <CardDescription>
                  {getAppointmentsForDate(selectedDate).length} appointments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px] pr-4">
                  {getAppointmentsForDate(selectedDate).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No appointments scheduled</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setActiveDialog("new")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Appointment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getAppointmentsForDate(selectedDate)
                        .sort((a, b) =>
                          a.appointmentTime.localeCompare(b.appointmentTime),
                        )
                        .map((apt) => {
                          const patient = getPatient(apt.patientId);
                          const doctor = apt.doctor;
                          const statusInfo = STATUS_CONFIG[apt.status];
                          const StatusIcon = statusInfo?.icon || CalendarDays;
                          return (
                            <div
                              key={apt.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${statusInfo?.bgColor || "bg-white"}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium">
                                    {apt.appointmentTime}
                                  </span>
                                </div>
                                <Badge
                                  className={`${statusInfo?.bgColor} ${statusInfo?.color} border-0`}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo?.label}
                                </Badge>
                              </div>
                              <div className="mt-2 font-medium">
                                {getPatientFullName(patient || null)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {patient?.mrn} • {doctor?.fullName}
                              </div>
                              <div className="mt-2 text-sm text-gray-600">
                                {apt.chiefComplaint}
                              </div>
                              <Badge
                                variant="outline"
                                className={`mt-2 ${APPOINTMENT_TYPE_CONFIG[apt.appointmentType || "new_patient"]?.color}`}
                              >
                                {
                                  APPOINTMENT_TYPE_CONFIG[
                                    apt.appointmentType || "new_patient"
                                  ]?.label
                                }
                              </Badge>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Weekly View ── */}
        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Weekly Calendar — {format(currentWeek, "dd MMM")} –{" "}
                  {format(addDays(currentWeek, 6), "dd MMM yyyy")}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentWeek(
                        startOfWeek(new Date(), { weekStartsOn: 1 }),
                      )
                    }
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="grid grid-cols-7 border-b">
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = addDays(currentWeek, i);
                  const isCurrentDay = isToday(day);
                  return (
                    <div
                      key={i}
                      className={`p-3 text-center border-r last:border-r-0 ${isCurrentDay ? "bg-blue-50" : ""}`}
                    >
                      <div
                        className={`text-xs font-semibold uppercase ${isCurrentDay ? "text-blue-600" : "text-gray-500"}`}
                      >
                        {format(day, "EEE")}
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1 ${isCurrentDay ? "text-blue-600" : "text-gray-800"}`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="text-xs text-gray-400">
                        {format(day, "MMM")}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = addDays(currentWeek, i);
                  const dayApts = appointments
                    .filter((apt) =>
                      isSameDay(parseDate(apt.appointmentDate), day),
                    )
                    .sort((a, b) =>
                      a.appointmentTime.localeCompare(b.appointmentTime),
                    );
                  const isCurrentDay = isToday(day);
                  return (
                    <div
                      key={i}
                      className={`border-r last:border-r-0 p-2 space-y-1 ${isCurrentDay ? "bg-blue-50/30" : ""}`}
                    >
                      {dayApts.length === 0 && (
                        <p className="text-xs text-gray-300 text-center mt-4">
                          —
                        </p>
                      )}
                      {dayApts.map((apt) => {
                        const patient =
                          apt.patient || getPatient(apt.patientId);
                        const patientName = patient
                          ? `${patient.firstName} ${patient.lastName}`.trim()
                          : "Unknown";
                        const cfg =
                          STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                        return (
                          <div
                            key={apt.id}
                            className={`rounded p-1.5 text-xs cursor-pointer hover:opacity-80 ${cfg.bgColor}`}
                          >
                            <div className="font-semibold truncate">
                              {apt.appointmentTime}
                            </div>
                            <div className="truncate">{patientName}</div>
                            {apt.doctor && (
                              <div className="truncate text-gray-500">
                                {drName(apt.doctor.fullName)}
                              </div>
                            )}
                            <Badge
                              className={`text-[9px] px-1 py-0 ${cfg.bgColor} ${cfg.color} border-0`}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = addDays(currentWeek, i);
              const count = appointments.filter((apt) =>
                isSameDay(parseDate(apt.appointmentDate), day),
              ).length;
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 text-center ${isToday(day) ? "border-blue-400 bg-blue-50" : "bg-white"}`}
                >
                  <div className="text-sm font-medium text-gray-600">
                    {format(day, "EEEE")}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {count}
                  </div>
                  <div className="text-xs text-gray-400">appointments</div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── List View ── */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by patient, doctor, UHID..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Input
                  type="date"
                  className="w-[180px]"
                  value={format(selectedDate, "yyyy-MM-dd")}
                  onChange={(e) =>
                    e.target.value && setSelectedDate(new Date(e.target.value))
                  }
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {uniqueDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Doctors</SelectItem>
                    {filterDoctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No appointments found</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveDialog("new")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Appointment
                  </Button>
                </div>
              ) : (
                <>
                  {selectedAptIds.size > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border-b border-blue-200">
                      <span className="text-sm font-medium text-blue-700">
                        {selectedAptIds.size} selected
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkStatusUpdate("confirmed")}
                      >
                        Confirm All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkStatusUpdate("cancelled")}
                      >
                        Cancel All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkStatusUpdate("no_show")}
                      >
                        No-Show All
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedAptIds(new Set())}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              selectedAptIds.size ===
                                filteredAppointments.length &&
                              filteredAppointments.length > 0
                            }
                            onCheckedChange={toggleAllApts}
                          />
                        </TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Chief Complaint</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const sorted = filteredAppointments.sort((a, b) =>
                          a.appointmentTime.localeCompare(b.appointmentTime),
                        );
                        const startIdx =
                          (appointmentsListPage - 1) *
                          APPOINTMENTS_LIST_PER_PAGE;
                        const endIdx = startIdx + APPOINTMENTS_LIST_PER_PAGE;
                        const paginatedApts = sorted.slice(startIdx, endIdx);
                        return paginatedApts.map((apt) => {
                          const patient = getPatient(apt.patientId);
                          const doctor = apt.doctor;
                          const statusInfo = STATUS_CONFIG[apt.status];
                          const StatusIcon = statusInfo?.icon || CalendarDays;
                          return (
                            <TableRow
                              key={apt.id}
                              className={
                                selectedAptIds.has(apt.id) ? "bg-blue-50" : ""
                              }
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedAptIds.has(apt.id)}
                                  onCheckedChange={() =>
                                    toggleAptSelection(apt.id)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-mono font-medium">
                                  {apt.appointmentTime}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-blue-100 text-blue-700">
                                      {patient?.firstName?.[0]}
                                      {patient?.lastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">
                                      {getPatientFullName(patient || null)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {patient?.mrn}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {doctor?.fullName || "Unassigned"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {doctor?.specialization}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div
                                  className="max-w-[200px] truncate"
                                  title={apt.chiefComplaint || ""}
                                >
                                  {apt.chiefComplaint || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    APPOINTMENT_TYPE_CONFIG[
                                      apt.appointmentType || "new_patient"
                                    ]?.color
                                  }
                                >
                                  {
                                    APPOINTMENT_TYPE_CONFIG[
                                      apt.appointmentType || "new_patient"
                                    ]?.label
                                  }
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`${statusInfo?.bgColor} ${statusInfo?.color} border-0`}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo?.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>
                                      Actions
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openEditDialog(apt)}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {apt.status === "scheduled" && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleConfirm(apt)}
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Confirm
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleSendReminder(apt)
                                          }
                                        >
                                          <Bell className="mr-2 h-4 w-4" />
                                          Send Reminder
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {(apt.status === "scheduled" ||
                                      apt.status === "confirmed") && (
                                      <DropdownMenuItem
                                        onClick={() => handleCheckIn(apt)}
                                      >
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        Check In
                                      </DropdownMenuItem>
                                    )}
                                    {(apt.status === "scheduled" ||
                                      apt.status === "confirmed" ||
                                      apt.status === "checked_in") && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleStartConsultation(apt)
                                        }
                                      >
                                        <Play className="mr-2 h-4 w-4" />
                                        Start Consultation
                                      </DropdownMenuItem>
                                    )}
                                    {apt.status === "in_progress" && (
                                      <DropdownMenuItem
                                        onClick={() => handleComplete(apt)}
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Complete
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    {(apt.status === "scheduled" ||
                                      apt.status === "confirmed") && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSelectedAppointment(apt);
                                            setActiveDialog("reschedule");
                                          }}
                                        >
                                          <RefreshCcw className="mr-2 h-4 w-4" />
                                          Reschedule
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => {
                                            setSelectedAppointment(apt);
                                            setActiveDialog("cancel");
                                          }}
                                        >
                                          <XCircle className="mr-2 h-4 w-4" />
                                          Cancel
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-amber-600"
                                          onClick={() => handleNoShow(apt)}
                                        >
                                          <AlertCircle className="mr-2 h-4 w-4" />
                                          Mark No-Show
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handlePrintAppointmentCard(apt)
                                      }
                                    >
                                      <Printer className="mr-2 h-4 w-4" />
                                      Print Appointment Card
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                  {filteredAppointments.length > APPOINTMENTS_LIST_PER_PAGE &&
                    (() => {
                      const totalPages = Math.ceil(
                        filteredAppointments.length /
                          APPOINTMENTS_LIST_PER_PAGE,
                      );
                      return (
                        <div className="flex items-center justify-end gap-2 p-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setAppointmentsListPage((p) => Math.max(1, p - 1))
                            }
                            disabled={appointmentsListPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {appointmentsListPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setAppointmentsListPage((p) =>
                                Math.min(totalPages, p + 1),
                              )
                            }
                            disabled={appointmentsListPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      );
                    })()}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Today's Schedule ── */}
        <TabsContent value="today" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current & Upcoming */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Current & Upcoming
                </CardTitle>
                <CardDescription>
                  Active and pending appointments for today
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  {appointments
                    .filter(
                      (a) =>
                        isSameDay(parseDate(a.appointmentDate), new Date()) &&
                        [
                          "scheduled",
                          "confirmed",
                          "checked_in",
                          "in_progress",
                        ].includes(a.status),
                    )
                    .sort((a, b) =>
                      a.appointmentTime.localeCompare(b.appointmentTime),
                    ).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No upcoming appointments today</p>
                    </div>
                  ) : (
                    appointments
                      .filter(
                        (a) =>
                          isSameDay(parseDate(a.appointmentDate), new Date()) &&
                          [
                            "scheduled",
                            "confirmed",
                            "checked_in",
                            "in_progress",
                          ].includes(a.status),
                      )
                      .sort((a, b) =>
                        a.appointmentTime.localeCompare(b.appointmentTime),
                      )
                      .map((apt) => {
                        const patient = getPatient(apt.patientId);
                        const doctor = apt.doctor;
                        const statusInfo = STATUS_CONFIG[apt.status];
                        const StatusIcon = statusInfo?.icon || CalendarDays;
                        return (
                          <div
                            key={apt.id}
                            className={`p-4 rounded-lg border mb-3 transition-all ${apt.status === "in_progress" ? "bg-orange-50 border-orange-300" : apt.status === "checked_in" ? "bg-green-50 border-green-300" : "bg-white hover:shadow-md"}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-center">
                                  <div className="font-mono text-lg font-bold">
                                    {apt.appointmentTime}
                                  </div>
                                </div>
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback
                                    className={`${apt.status === "in_progress" ? "bg-orange-200 text-orange-700" : apt.status === "checked_in" ? "bg-green-200 text-green-700" : "bg-blue-100 text-blue-700"}`}
                                  >
                                    {patient?.firstName?.[0]}
                                    {patient?.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {getPatientFullName(patient || null)}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {doctor?.fullName} • {patient?.mrn}
                                  </div>
                                  <div className="text-sm mt-1">
                                    {apt.chiefComplaint}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge
                                  className={`${statusInfo?.bgColor} ${statusInfo?.color} border-0`}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo?.label}
                                </Badge>
                                <div className="mt-2 flex flex-col gap-1">
                                  {apt.status === "scheduled" && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleConfirm(apt)}
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCheckIn(apt)}
                                      >
                                        Check In
                                      </Button>
                                    </>
                                  )}
                                  {apt.status === "confirmed" && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCheckIn(apt)}
                                    >
                                      Check In
                                    </Button>
                                  )}
                                  {apt.status === "checked_in" && (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleStartConsultation(apt)
                                      }
                                    >
                                      Start
                                    </Button>
                                  )}
                                  {apt.status === "in_progress" && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleComplete(apt)}
                                    >
                                      Complete
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={
                                  APPOINTMENT_TYPE_CONFIG[
                                    apt.appointmentType || "new_patient"
                                  ]?.color
                                }
                              >
                                {
                                  APPOINTMENT_TYPE_CONFIG[
                                    apt.appointmentType || "new_patient"
                                  ]?.label
                                }
                              </Badge>
                              {apt.reminderSent ? (
                                <Badge
                                  variant="outline"
                                  className="bg-green-100 text-green-700"
                                >
                                  <Bell className="h-3 w-3 mr-1" />
                                  Reminder Sent
                                </Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-6"
                                  onClick={() => handleSendReminder(apt)}
                                >
                                  <BellOff className="h-3 w-3 mr-1" />
                                  Send Reminder
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Completed & Others */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Completed & Others
                </CardTitle>
                <CardDescription>
                  Finished, cancelled, or no-show appointments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  {appointments
                    .filter(
                      (a) =>
                        isSameDay(parseDate(a.appointmentDate), new Date()) &&
                        [
                          "completed",
                          "cancelled",
                          "no_show",
                          "rescheduled",
                        ].includes(a.status),
                    )
                    .sort((a, b) =>
                      a.appointmentTime.localeCompare(b.appointmentTime),
                    ).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No completed appointments today</p>
                    </div>
                  ) : (
                    appointments
                      .filter(
                        (a) =>
                          isSameDay(parseDate(a.appointmentDate), new Date()) &&
                          [
                            "completed",
                            "cancelled",
                            "no_show",
                            "rescheduled",
                          ].includes(a.status),
                      )
                      .sort((a, b) =>
                        a.appointmentTime.localeCompare(b.appointmentTime),
                      )
                      .map((apt) => {
                        const patient = getPatient(apt.patientId);
                        const doctor = apt.doctor;
                        const statusInfo = STATUS_CONFIG[apt.status];
                        const StatusIcon = statusInfo?.icon || CalendarDays;
                        return (
                          <div
                            key={apt.id}
                            className="p-4 rounded-lg border mb-3 bg-gray-50 border-gray-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-center">
                                  <div className="font-mono text-lg font-bold text-gray-400">
                                    {apt.appointmentTime}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {apt.durationMinutes} min
                                  </div>
                                </div>
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-gray-200 text-gray-500">
                                    {patient?.firstName?.[0]}
                                    {patient?.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-gray-600">
                                    {getPatientFullName(patient || null)}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {doctor?.fullName} • {patient?.mrn}
                                  </div>
                                  <div className="text-sm mt-1 text-gray-500">
                                    {apt.chiefComplaint}
                                  </div>
                                </div>
                              </div>
                              <Badge
                                className={`${statusInfo?.bgColor} ${statusInfo?.color} border-0`}
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo?.label}
                              </Badge>
                            </div>
                            {apt.cancellationReason && (
                              <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                Reason: {apt.cancellationReason}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Doctor Slots ── */}
        <TabsContent value="doctor-slots" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Doctor Slot Availability
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedDoctor}
                    onValueChange={setSelectedDoctor}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select Doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Doctors</SelectItem>
                      {doctors.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {drName(doc.fullName)}
                          {doc.specialization ? ` — ${doc.specialization}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {format(currentWeek, "dd MMM")} –{" "}
                      {format(addDays(currentWeek, 6), "dd MMM")}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border bg-gray-50 px-3 py-2 text-left w-20 font-semibold text-gray-600">
                    Time
                  </th>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const day = addDays(currentWeek, i);
                    return (
                      <th
                        key={i}
                        className={`border px-2 py-2 text-center font-semibold ${isToday(day) ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}
                      >
                        <div>{format(day, "EEE")}</div>
                        <div className="text-base font-bold">
                          {format(day, "d")}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot} className="hover:bg-gray-50">
                    <td className="border px-3 py-1.5 font-medium text-gray-500 bg-gray-50">
                      {slot}
                    </td>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const day = addDays(currentWeek, i);
                      const slotApts = appointments.filter((apt) => {
                        const aptDay = isSameDay(
                          parseDate(apt.appointmentDate),
                          day,
                        );
                        const aptTime = apt.appointmentTime === slot;
                        const doctorMatch =
                          selectedDoctor === "all" ||
                          apt.doctorId === selectedDoctor;
                        return aptDay && aptTime && doctorMatch;
                      });
                      const isBooked = slotApts.length > 0;
                      return (
                        <td
                          key={i}
                          className={`border px-1 py-1 text-center ${isBooked ? "bg-red-50" : "bg-green-50"}`}
                        >
                          {isBooked ? (
                            slotApts.map((apt) => {
                              const patient =
                                apt.patient || getPatient(apt.patientId);
                              return (
                                <div
                                  key={apt.id}
                                  className="rounded bg-red-100 border border-red-200 px-1 py-0.5 text-[10px] text-red-700 truncate"
                                  title={
                                    patient
                                      ? `${patient.firstName} ${patient.lastName}`
                                      : "Booked"
                                  }
                                >
                                  {patient
                                    ? `${patient.firstName} ${patient.lastName}`.substring(
                                        0,
                                        10,
                                      )
                                    : "Booked"}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-green-400 text-[10px]">
                              Free
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
              <span className="text-gray-600">Booked</span>
            </div>
          </div>

          {doctors.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {doctors
                .filter(
                  (doc) =>
                    selectedDoctor === "all" || doc.id === selectedDoctor,
                )
                .map((doc) => {
                  const weekStart = currentWeek;
                  const weekEnd = addDays(currentWeek, 6);
                  const count = appointments.filter((apt) => {
                    const d = parseDate(apt.appointmentDate);
                    return (
                      apt.doctorId === doc.id && d >= weekStart && d <= weekEnd
                    );
                  }).length;
                  return (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                          {doc.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">
                            {drName(doc.fullName)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {doc.specialization || "General"}
                          </div>
                          <div className="text-blue-600 font-bold">
                            {count} this week
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Appointment Dialog */}
      <Dialog
        open={activeDialog === "edit"}
        onOpenChange={(open) => {
          setActiveDialog(open ? "edit" : null);
          if (!open) setEditingAppointment(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
            <DialogDescription>
              {editingAppointment &&
                `Patient: ${getPatientFullName(getPatient(editingAppointment.patientId) || null)}`}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="doctorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select doctor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {doctors.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.fullName} - {doc.specialization}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={
                            field.value ? format(field.value, "yyyy-MM-dd") : ""
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? new Date(e.target.value) : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIME_SLOTS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="appointmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new_patient">
                            New Patient
                          </SelectItem>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <SelectItem key={key} value={key}>
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">

                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="chiefComplaint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chief Complaint *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Patient's main complaint..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveDialog(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditSubmitting}>
                  {isEditSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={activeDialog === "cancel"} onOpenChange={(open) => setActiveDialog(open ? "cancel" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAppointment && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="font-medium">
                  {getPatientFullName(
                    getPatient(selectedAppointment.patientId) || null,
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {format(
                    parseDate(selectedAppointment.appointmentDate),
                    "PPP",
                  )}{" "}
                  at {selectedAppointment.appointmentTime}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="reason">Cancellation Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for cancellation..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActiveDialog(null);
                setSelectedAppointment(null);
                setCancellationReason("");
              }}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog
        open={activeDialog === "reschedule"}
        onOpenChange={(open) => setActiveDialog(open ? "reschedule" : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAppointment && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="font-medium">
                  {getPatientFullName(
                    getPatient(selectedAppointment.patientId) || null,
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  Current:{" "}
                  {format(
                    parseDate(selectedAppointment.appointmentDate),
                    "PPP",
                  )}{" "}
                  at {selectedAppointment.appointmentTime}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>New Date</Label>
                <Input
                  type="date"
                  value={
                    rescheduleDate ? format(rescheduleDate, "yyyy-MM-dd") : ""
                  }
                  onChange={(e) =>
                    setRescheduleDate(
                      e.target.value ? new Date(e.target.value) : null,
                    )
                  }
                />
              </div>
              <div>
                <Label>New Time</Label>
                <Select
                  value={rescheduleTime}
                  onValueChange={setRescheduleTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActiveDialog(null);
                setSelectedAppointment(null);
                setRescheduleDate(null);
                setRescheduleTime("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
