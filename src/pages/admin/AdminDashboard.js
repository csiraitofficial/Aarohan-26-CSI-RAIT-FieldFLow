import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection, query, where, doc, getDoc, getDocs,
  onSnapshot, updateDoc, addDoc, deleteDoc, setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, Users, ClipboardList, Wallet,
  LogOut, Plus, Trash2, Phone, Calendar, Clock,
  MapPin, FileText, Sun, Sunset, Sunrise, User,
  AlertCircle, CheckCircle2, XCircle, ChevronRight,
  TrendingUp, AlertTriangle, Eye, UserPlus, Shield,
} from "lucide-react";

const SLOT_CFG = {
  "8-12":  { label: "Morning",   time: "8AM–12PM", icon: Sunrise, color: "#f59e0b", rate: 300 },
  "2-6":   { label: "Afternoon", time: "2PM–6PM",  icon: Sunset,  color: "#ea580c", rate: 300 },
  fullday: { label: "Full Day",  time: "8AM–6PM",  icon: Sun,     color: "#16a34a", rate: 600 },
};

const LABOUR_MONTHLY = 6000;
const SUP_MONTHLY    = 8000;

const today = new Date().toISOString().split("T")[0];

export default function AdminDashboard() {
  const [activeTab,    setActiveTab]    = useState("overview");
  const [allBookings,  setAllBookings]  = useState([]);
  const [allUsers,     setAllUsers]     = useState([]);
  const [allLabours,   setAllLabours]   = useState([]);
  const [loading,      setLoading]      = useState(false);

  // Admin booking modal
  const [bookModal,        setBookModal]        = useState(false);
  const [bFarmerId,        setBFarmerId]        = useState("");
  const [bSupervisorId,    setBSupervisorId]    = useState("");
  const [bDate,            setBDate]            = useState("");
  const [bSlot,            setBSlot]            = useState("8-12");
  const [bLabourCount,     setBLabourCount]     = useState(1);
  const [bAddress,         setBAddress]         = useState("");
  const [bLandmark,        setBLandmark]        = useState("");
  const [bWorkType,        setBWorkType]        = useState("🌾 Harvesting");
  const [bSelectedLabours, setBSelectedLabours] = useState([]);

  // Add supervisor modal
  const [addSupModal,  setAddSupModal]  = useState(false);
  const [supName,      setSupName]      = useState("");
  const [supPhone,     setSupPhone]     = useState("");
  const [supEmail,     setSupEmail]     = useState("");
  const [supPassword,  setSupPassword]  = useState("");

  // Add labour modal
  const [addLabourModal, setAddLabourModal] = useState(false);
  const [labName,        setLabName]        = useState("");
  const [labPhone,       setLabPhone]       = useState("");
  const [labSupId,       setLabSupId]       = useState("");

  // Detail modals
  const [detailModal, setDetailModal] = useState(null); // { type: 'farmer'|'supervisor'|'labour'|'booking', data }

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { navigate("/login"); return; }

    const u1 = onSnapshot(collection(db, "bookings"), snap => {
      setAllBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(collection(db, "users"), snap => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u3 = onSnapshot(collection(db, "labours"), snap => {
      setAllLabours(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); u3(); };
  }, [navigate]);

  const farmers     = allUsers.filter(u => u.role === "farmer");
  const supervisors = allUsers.filter(u => u.role === "supervisor");

  // ── AVAILABILITY ──
  const isLabourAvailable = (labour, date, slot) => {
    const key = `${date}_${slot}`;
    if (labour.unavailability?.[key]) return false;
    if (slot === "fullday") {
      if (labour.unavailability?.[`${date}_8-12`]) return false;
      if (labour.unavailability?.[`${date}_2-6`])  return false;
    }
    return !allBookings.some(b => {
      if (b.status !== "assigned") return false;
      if (b.date !== date) return false;
      if (!b.assignedLabourIds?.includes(labour.id)) return false;
      return b.timeSlot === slot || b.timeSlot === "fullday" || slot === "fullday";
    });
  };

  const getAvailableLabours = (date, slot, supervisorId) => {
    return allLabours.filter(l =>
      (!supervisorId || l.supervisorId === supervisorId) &&
      isLabourAvailable(l, date, slot)
    );
  };

  // ── STATS ──
  const totalRevenue     = allBookings.filter(b => b.status === "assigned" || b.status === "completed")
                            .reduce((s, b) => s + (b.totalCost || 0), 0);
  const labourSalaries   = allLabours.length * LABOUR_MONTHLY;
  const supSalaries      = supervisors.length * SUP_MONTHLY;
  const totalExpenses    = labourSalaries + supSalaries;
  const liveBookings     = allBookings.filter(b => b.status === "assigned");
  const pendingBookings  = allBookings.filter(b => b.status === "pending");

  // Attendance mismatches
  const mismatches = allBookings.filter(b => {
    if (b.status !== "assigned") return false;
    if (!b.farmerConfirmed && !b.supervisorConfirmed) return false;
    if (b.farmerConfirmed !== b.supervisorConfirmed) return true;
    return false;
  });

  // Holidays today
  const holidaysToday = allLabours.filter(l =>
    Object.keys(l.unavailability || {}).some(k => k.startsWith(today))
  );

  // ── ADD SUPERVISOR ──
  const handleAddSupervisor = async (e) => {
    e.preventDefault();
    if (!supName || !supPhone || !supEmail || !supPassword) { toast.error("Fill all fields!"); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, supEmail, supPassword);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: supName, phone: supPhone, email: supEmail,
        role: "supervisor", labourCount: 0, createdAt: new Date(),
      });
      toast.success(`Supervisor ${supName} created! ✅`);
      setAddSupModal(false); setSupName(""); setSupPhone(""); setSupEmail(""); setSupPassword("");
    } catch (err) {
      toast.error(err.code === "auth/email-already-in-use" ? "Email already in use!" : "Failed to create.");
    }
    setLoading(false);
  };

  // ── ADD LABOUR ──
  const handleAddLabour = async (e) => {
    e.preventDefault();
    if (!labName || !labPhone || !labSupId) { toast.error("Fill all fields!"); return; }
    setLoading(true);
    try {
      const sup = supervisors.find(s => s.id === labSupId);
      await addDoc(collection(db, "labours"), {
        name: labName, phone: labPhone,
        supervisorId: labSupId, supervisorName: sup?.name,
        available: true, unavailability: {}, createdAt: new Date(),
      });
      toast.success(`${labName} added! ✅`);
      setAddLabourModal(false); setLabName(""); setLabPhone(""); setLabSupId("");
    } catch { toast.error("Failed to add labour."); }
    setLoading(false);
  };

  // ── DELETE ──
  const handleDeleteLabour = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    await deleteDoc(doc(db, "labours", id));
    toast.success(`${name} removed.`);
  };

  const handleDeleteSupervisor = async (id, name) => {
    if (!window.confirm(`Remove supervisor ${name}? Their labours will remain.`)) return;
    await deleteDoc(doc(db, "users", id));
    toast.success(`${name} removed.`);
  };

  // ── ADMIN BOOK ──
  const handleAdminBook = async () => {
    if (!bFarmerId || !bSupervisorId || !bDate || !bAddress) {
      toast.error("Fill farmer, supervisor, date and address!"); return;
    }
    if (bSelectedLabours.length === 0) { toast.error("Select at least 1 labour!"); return; }
    const farmer = farmers.find(f => f.id === bFarmerId);
    const sup    = supervisors.find(s => s.id === bSupervisorId);
    const chosen = allLabours.filter(l => bSelectedLabours.includes(l.id));
    const rate   = SLOT_CFG[bSlot]?.rate || 300;
    const cost   = bLabourCount * rate;

    setLoading(true);
    try {
      await addDoc(collection(db, "bookings"), {
        farmerId:    bFarmerId,  farmerName:  farmer?.name,  farmerPhone: farmer?.phone,
        village:     farmer?.village,  farmAddress: bAddress,  landmark: bLandmark,
        supervisorId:    bSupervisorId,  supervisorName:  sup?.name,  supervisorPhone: sup?.phone,
        labourCount:     bLabourCount,
        assignedLabour:  bSelectedLabours.length,
        assignedLabourIds:   bSelectedLabours,
        assignedLabourNames: chosen.map(l => l.name),
        timeSlot: bSlot,  workType: bWorkType,  date: bDate,
        totalCost: cost,  ratePerLabour: rate,
        status: "assigned",
        farmerConfirmed: false,  supervisorConfirmed: false,
        labourAttendance: {},
        bookedByAdmin: true,
        createdAt: new Date(),
      });
      toast.success("Booking created & assigned! ✅");
      setBookModal(false);
      setBFarmerId(""); setBSupervisorId(""); setBDate(""); setBAddress("");
      setBLandmark(""); setBSelectedLabours([]); setBLabourCount(1);
    } catch { toast.error("Failed to create booking."); }
    setLoading(false);
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  const getStatusStyle = (s) => {
    if (s === "pending")   return { bg: "#fef3c7", color: "#92400e",  border: "#fde68a" };
    if (s === "assigned")  return { bg: "#d1fae5", color: "#065f46",  border: "#a7f3d0" };
    if (s === "completed") return { bg: "#ede9fe", color: "#3730a3",  border: "#c4b5fd" };
    return { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" };
  };

  const availForAdminBook = bDate && bSlot && bSupervisorId
    ? getAvailableLabours(bDate, bSlot, bSupervisorId)
    : [];

  const TABS = [
    { id: "overview",     icon: LayoutDashboard, label: "Overview" },
    { id: "bookings",     icon: ClipboardList,   label: "All Bookings" },
    { id: "book",         icon: Plus,            label: "Create Booking" },
    { id: "supervisors",  icon: Shield,          label: "Supervisors" },
    { id: "labours",      icon: Users,           label: "Labours" },
    { id: "farmers",      icon: User,            label: "Farmers" },
    { id: "finance",      icon: Wallet,          label: "Finance" },
  ];

  return (
    <div style={A.root}>
      <Toaster position="top-right" />

      {/* ── ADD SUPERVISOR MODAL ── */}
      <AnimatePresence>
        {addSupModal && (
          <motion.div style={A.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={A.modal} initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}>
              <h3 style={A.modalTitle}>Add Supervisor</h3>
              <form onSubmit={handleAddSupervisor} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { label: "Full Name", val: supName, set: setSupName, type: "text", ph: "Supervisor name" },
                  { label: "Phone",     val: supPhone, set: setSupPhone, type: "tel",  ph: "10 digit phone" },
                  { label: "Email",     val: supEmail, set: setSupEmail, type: "email",ph: "Email address" },
                  { label: "Password",  val: supPassword, set: setSupPassword, type: "password", ph: "Min 6 chars" },
                ].map(f => (
                  <div key={f.label}>
                    <label style={A.label}>{f.label}</label>
                    <input style={A.minput} type={f.type} placeholder={f.ph}
                      value={f.val} onChange={e => f.set(e.target.value)} />
                  </div>
                ))}
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button type="submit" style={A.greenBtn} disabled={loading}>
                    {loading ? "Creating..." : "✅ Create Supervisor"}
                  </button>
                  <button type="button" style={A.cancelBtn} onClick={() => setAddSupModal(false)}>Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ADD LABOUR MODAL ── */}
      <AnimatePresence>
        {addLabourModal && (
          <motion.div style={A.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={A.modal} initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}>
              <h3 style={A.modalTitle}>Add Labour</h3>
              <form onSubmit={handleAddLabour} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={A.label}>Full Name</label>
                  <input style={A.minput} type="text" placeholder="Labour name" value={labName} onChange={e => setLabName(e.target.value)} />
                </div>
                <div>
                  <label style={A.label}>Phone</label>
                  <input style={A.minput} type="tel" placeholder="10 digit phone" value={labPhone} onChange={e => setLabPhone(e.target.value)} maxLength={10} />
                </div>
                <div>
                  <label style={A.label}>Assign to Supervisor</label>
                  <select style={A.minput} value={labSupId} onChange={e => setLabSupId(e.target.value)}>
                    <option value="">Select supervisor...</option>
                    {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="submit" style={A.greenBtn} disabled={loading}>
                    {loading ? "Adding..." : "✅ Add Labour"}
                  </button>
                  <button type="button" style={A.cancelBtn} onClick={() => setAddLabourModal(false)}>Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DETAIL MODAL ── */}
      <AnimatePresence>
        {detailModal && (
          <motion.div style={A.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDetailModal(null)}>
            <motion.div style={{ ...A.modal, maxWidth: "520px" }}
              initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={A.modalTitle}>{detailModal.type === "booking" ? "Booking Details" : `${detailModal.type.charAt(0).toUpperCase() + detailModal.type.slice(1)} Details`}</h3>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "20px" }}
                  onClick={() => setDetailModal(null)}>×</button>
              </div>

              {(detailModal.type === "farmer" || detailModal.type === "supervisor") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    ["Name",    detailModal.data.name],
                    ["Email",   detailModal.data.email],
                    ["Phone",   detailModal.data.phone],
                    ["Village", detailModal.data.village],
                    ["Role",    detailModal.data.role],
                    ["Crops",   Array.isArray(detailModal.data.cropType) ? detailModal.data.cropType.join(", ") : detailModal.data.cropType],
                    ["Farm Size", detailModal.data.farmSize],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={A.detailRow}>
                      <span style={A.detailKey}>{k}</span>
                      <span style={A.detailVal}>{v}</span>
                    </div>
                  ))}
                  {detailModal.type === "supervisor" && (
                    <>
                      <div style={A.detailRow}>
                        <span style={A.detailKey}>Labours</span>
                        <span style={A.detailVal}>{allLabours.filter(l => l.supervisorId === detailModal.data.id).length}</span>
                      </div>
                      <div style={A.detailRow}>
                        <span style={A.detailKey}>Active Assignments</span>
                        <span style={A.detailVal}>{allBookings.filter(b => b.supervisorId === detailModal.data.id && b.status === "assigned").length}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {detailModal.type === "labour" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    ["Name",       detailModal.data.name],
                    ["Phone",      detailModal.data.phone],
                    ["Supervisor", detailModal.data.supervisorName],
                  ].map(([k, v]) => (
                    <div key={k} style={A.detailRow}><span style={A.detailKey}>{k}</span><span style={A.detailVal}>{v}</span></div>
                  ))}
                  <div style={A.detailKey}>Unavailability Schedule</div>
                  {Object.entries(detailModal.data.unavailability || {}).length === 0
                    ? <p style={{ fontSize: "13px", color: "#9ca3af" }}>No unavailability set</p>
                    : Object.entries(detailModal.data.unavailability || {}).map(([key, reason]) => {
                        const [d, s] = key.split("_");
                        return (
                          <div key={key} style={{ ...A.detailRow, backgroundColor: "#fef2f2", borderRadius: "6px", padding: "6px 10px" }}>
                            <span style={{ fontSize: "12px", color: "#dc2626" }}>🚫 {d} · {SLOT_CFG[s]?.label || s}</span>
                            <span style={{ fontSize: "12px", color: "#9ca3af" }}>{reason}</span>
                          </div>
                        );
                      })
                  }
                </div>
              )}

              {detailModal.type === "booking" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    ["Date",     detailModal.data.date],
                    ["Slot",     SLOT_CFG[detailModal.data.timeSlot]?.label + " · " + SLOT_CFG[detailModal.data.timeSlot]?.time],
                    ["Farmer",   detailModal.data.farmerName],
                    ["Phone",    detailModal.data.farmerPhone],
                    ["Address",  detailModal.data.farmAddress],
                    ["Landmark", detailModal.data.landmark],
                    ["Work",     detailModal.data.workType],
                    ["Labours",  detailModal.data.labourCount + " requested"],
                    ["Assigned", (detailModal.data.assignedLabour || 0) + " assigned"],
                    ["Supervisor", detailModal.data.supervisorName],
                    ["Sup Phone",  detailModal.data.supervisorPhone],
                    ["Total Cost", "₹" + (detailModal.data.totalCost || 0).toLocaleString()],
                    ["Status",   detailModal.data.status],
                    ["Farmer Confirmed",     detailModal.data.farmerConfirmed ? "Yes ✅" : "No"],
                    ["Supervisor Confirmed", detailModal.data.supervisorConfirmed ? "Yes ✅" : "No"],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={A.detailRow}><span style={A.detailKey}>{k}</span><span style={A.detailVal}>{v}</span></div>
                  ))}

                  {detailModal.data.assignedLabourNames?.length > 0 && (
                    <>
                      <p style={{ ...A.detailKey, marginTop: "8px" }}>Assigned Labours & Attendance</p>
                      {detailModal.data.assignedLabourNames.map((name, idx) => {
                        const lid = detailModal.data.assignedLabourIds?.[idx];
                        const present = detailModal.data.labourAttendance?.[lid];
                        const farmerSays = present === true;
                        return (
                          <div key={idx} style={{
                            ...A.detailRow,
                            backgroundColor: farmerSays ? "#f0fdf4" : "#fef2f2",
                            borderRadius: "8px", padding: "8px 12px",
                            border: `1px solid ${farmerSays ? "#bbf7d0" : "#fecaca"}`,
                          }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>👤 {name}</span>
                            <span style={{ fontSize: "12px", color: farmerSays ? "#15803d" : "#dc2626", fontWeight: 600 }}>
                              {farmerSays ? "✅ Present" : "❌ Absent / Unconfirmed"}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <motion.aside style={A.sidebar}
        initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>

        <div style={A.sidebarTop}>
          <div style={A.logoMark}>
            <span style={{ fontSize: "18px" }}>🌱</span>
          </div>
          <div>
            <div style={A.logoTitle}>KrishiSetu</div>
            <div style={A.logoSub}>Admin Control</div>
          </div>
        </div>

        <nav style={{ padding: "8px" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button key={tab.id}
                style={{
                  ...A.navBtn,
                  backgroundColor: isActive ? "#166534" : "transparent",
                  color: isActive ? "#ffffff" : "#6b7280",
                }}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ x: isActive ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}>
                <Icon size={16} color={isActive ? "#86efac" : "#9ca3af"} />
                <span>{tab.label}</span>
                {tab.id === "bookings" && pendingBookings.length > 0 && (
                  <span style={A.redBadge}>{pendingBookings.length}</span>
                )}
                {tab.id === "overview" && mismatches.length > 0 && (
                  <span style={A.redBadge}>{mismatches.length}</span>
                )}
              </motion.button>
            );
          })}
        </nav>

        <div style={A.sidebarBottom}>
          <button style={A.logoutBtn} onClick={handleLogout}>
            <LogOut size={14} color="#dc2626" />
            <span style={{ color: "#dc2626", fontSize: "13px", fontWeight: 600 }}>Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* ── MAIN ── */}
      <main style={A.main}>
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <motion.div key="overview"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>

              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>Overview</h1>
                  <p style={A.pageSub}>KrishiSetu platform at a glance · Today: {today}</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div style={A.kpiGrid}>
                {[
                  { label: "Total Farmers",     value: farmers.length,       icon: "🧑‍🌾", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
                  { label: "Supervisors",        value: supervisors.length,   icon: "👨‍💼", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
                  { label: "Total Labours",      value: allLabours.length,    icon: "👷", color: "#7c2d12", bg: "#fff7ed", border: "#fed7aa" },
                  { label: "Live Bookings",      value: liveBookings.length,  icon: "📋", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
                  { label: "Pending Requests",   value: pendingBookings.length, icon: "⏳", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
                  { label: "Attendance Mismatches", value: mismatches.length, icon: "⚠️", color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
                ].map(k => (
                  <motion.div key={k.label} style={{ ...A.kpiCard, backgroundColor: k.bg, border: `1.5px solid ${k.border}` }}
                    whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{k.icon}</div>
                    <div style={{ fontSize: "28px", fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", fontWeight: 600 }}>{k.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Revenue strip */}
              <div style={A.revenueStrip}>
                <div style={A.revItem}>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Revenue Collected</div>
                  <div style={{ fontSize: "24px", fontWeight: 900, color: "#166534" }}>₹{totalRevenue.toLocaleString()}</div>
                </div>
                <div style={A.revDivider} />
                <div style={A.revItem}>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Labour Salaries / month</div>
                  <div style={{ fontSize: "24px", fontWeight: 900, color: "#dc2626" }}>₹{labourSalaries.toLocaleString()}</div>
                </div>
                <div style={A.revDivider} />
                <div style={A.revItem}>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Supervisor Salaries / month</div>
                  <div style={{ fontSize: "24px", fontWeight: 900, color: "#dc2626" }}>₹{supSalaries.toLocaleString()}</div>
                </div>
                <div style={A.revDivider} />
                <div style={A.revItem}>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Net (Revenue − Expenses)</div>
                  <div style={{ fontSize: "24px", fontWeight: 900, color: totalRevenue - totalExpenses >= 0 ? "#166534" : "#dc2626" }}>
                    ₹{(totalRevenue - totalExpenses).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Mismatches */}
              {mismatches.length > 0 && (
                <div style={A.section}>
                  <div style={A.sectionHeader}>
                    <AlertTriangle size={16} color="#dc2626" />
                    <span style={{ ...A.sectionTitle, color: "#dc2626" }}>Attendance Mismatches ({mismatches.length})</span>
                  </div>
                  {mismatches.map(b => (
                    <div key={b.id} style={{ ...A.row, backgroundColor: "#fef2f2", border: "1.5px solid #fecaca" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "#1f2937" }}>{b.farmerName} · {b.date}</span>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          Farmer: {b.farmerConfirmed ? "✅ Confirmed" : "❌ Not confirmed"} ·
                          Supervisor: {b.supervisorConfirmed ? "✅ Confirmed" : "❌ Not confirmed"}
                        </span>
                      </div>
                      <button style={A.viewBtn} onClick={() => setDetailModal({ type: "booking", data: b })}>View</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Holidays Today */}
              {holidaysToday.length > 0 && (
                <div style={A.section}>
                  <div style={A.sectionHeader}>
                    <XCircle size={15} color="#ea580c" />
                    <span style={A.sectionTitle}>Labours on Leave Today</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {holidaysToday.map(l => {
                      const todayKeys = Object.keys(l.unavailability || {}).filter(k => k.startsWith(today));
                      return todayKeys.map(key => {
                        const [, s] = key.split("_");
                        return (
                          <div key={key} style={A.holidayChip}>
                            👤 {l.name} · {SLOT_CFG[s]?.label || s}
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              )}

              {/* Live Bookings */}
              <div style={A.section}>
                <div style={A.sectionHeader}>
                  <div style={A.greenDot} />
                  <span style={A.sectionTitle}>Live Active Bookings ({liveBookings.length})</span>
                </div>
                {liveBookings.length === 0
                  ? <p style={A.emptyText}>No active bookings right now</p>
                  : liveBookings.slice(0, 5).map(b => {
                      const sc  = SLOT_CFG[b.timeSlot];
                      const ss  = getStatusStyle(b.status);
                      return (
                        <div key={b.id} style={A.row}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: "#1f2937" }}>
                              {b.farmerName} · {b.date}
                            </span>
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>
                              {sc?.label} · {b.labourCount} labours · {b.supervisorName || "Unassigned"} · ₹{(b.totalCost || 0).toLocaleString()}
                            </span>
                          </div>
                          <button style={A.viewBtn} onClick={() => setDetailModal({ type: "booking", data: b })}>View</button>
                        </div>
                      );
                    })
                }
              </div>
            </motion.div>
          )}

          {/* ── ALL BOOKINGS ── */}
          {activeTab === "bookings" && (
            <motion.div key="bookings"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>All Bookings</h1>
                  <p style={A.pageSub}>{allBookings.length} total bookings</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {allBookings
                  .sort((a, b) => new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0))
                  .map(b => {
                    const sc  = SLOT_CFG[b.timeSlot];
                    const ss  = getStatusStyle(b.status);
                    const SlotIcon = sc?.icon || Clock;
                    const presentCount = Object.values(b.labourAttendance || {}).filter(Boolean).length;
                    const mismatch = b.farmerConfirmed !== b.supervisorConfirmed && (b.farmerConfirmed || b.supervisorConfirmed);

                    return (
                      <motion.div key={b.id} style={{
                        ...A.bookingCard,
                        border: mismatch ? "2px solid #fca5a5" : "1.5px solid #e5e7eb",
                        backgroundColor: mismatch ? "#fef2f2" : "#ffffff",
                      }}
                        whileHover={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ ...A.badge, backgroundColor: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                              {b.status}
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>
                              {b.farmerName}
                            </span>
                            <span style={{ fontSize: "12px", color: "#9ca3af" }}>{b.date}</span>
                            <span style={{ fontSize: "12px", color: sc?.color, fontWeight: 600 }}>{sc?.label}</span>
                            {mismatch && <span style={{ fontSize: "11px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>⚠️ Mismatch</span>}
                            {b.bookedByAdmin && <span style={{ fontSize: "11px", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>Admin Booked</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontWeight: 800, fontSize: "15px", color: "#1f2937" }}>₹{(b.totalCost || 0).toLocaleString()}</span>
                            <button style={A.viewBtn} onClick={() => setDetailModal({ type: "booking", data: b })}>
                              <Eye size={13} /> View
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginTop: "10px" }}>
                          {[
                            { icon: Users,   val: `${b.labourCount} labours` },
                            { icon: User,    val: b.supervisorName || "Unassigned" },
                            { icon: MapPin,  val: b.farmAddress || b.village },
                            { icon: FileText,val: b.workType || "General" },
                          ].map(({ icon: Icon, val }, i) => (
                            <div key={i} style={A.bInfoCell}>
                              <Icon size={12} color="#9ca3af" />
                              <span style={{ fontSize: "12px", color: "#6b7280" }}>{val}</span>
                            </div>
                          ))}
                        </div>

                        {/* Attendance row */}
                        {b.assignedLabourNames?.length > 0 && (
                          <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {b.assignedLabourNames.map((name, idx) => {
                              const lid = b.assignedLabourIds?.[idx];
                              const present = b.labourAttendance?.[lid] === true;
                              return (
                                <span key={idx} style={{
                                  fontSize: "11px", padding: "3px 9px", borderRadius: "10px", fontWeight: 600,
                                  backgroundColor: present ? "#f0fdf4" : "#f9fafb",
                                  color: present ? "#15803d" : "#9ca3af",
                                  border: `1px solid ${present ? "#bbf7d0" : "#e5e7eb"}`,
                                }}>
                                  {present ? "✅" : "⬜"} {name}
                                </span>
                              );
                            })}
                            <span style={{ fontSize: "11px", color: "#9ca3af", alignSelf: "center" }}>
                              · Farmer: {b.farmerConfirmed ? "✅" : "❌"} Supervisor: {b.supervisorConfirmed ? "✅" : "❌"}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {/* ── CREATE BOOKING (ADMIN) ── */}
          {activeTab === "book" && (
            <motion.div key="book"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>Create Booking</h1>
                  <p style={A.pageSub}>Book labour on behalf of a farmer — bypasses pending status, assigns directly</p>
                </div>
              </div>

              <div style={A.formCard}>
                <div style={A.formGrid}>
                  {/* Farmer */}
                  <div>
                    <label style={A.label}>Select Farmer</label>
                    <select style={A.minput} value={bFarmerId} onChange={e => setBFarmerId(e.target.value)}>
                      <option value="">Choose farmer...</option>
                      {farmers.map(f => <option key={f.id} value={f.id}>{f.name} · {f.phone}</option>)}
                    </select>
                  </div>

                  {/* Supervisor */}
                  <div>
                    <label style={A.label}>Select Supervisor</label>
                    <select style={A.minput} value={bSupervisorId} onChange={e => { setBSupervisorId(e.target.value); setBSelectedLabours([]); }}>
                      <option value="">Choose supervisor...</option>
                      {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label style={A.label}>Date</label>
                    <input style={A.minput} type="date" value={bDate}
                      onChange={e => { setBDate(e.target.value); setBSelectedLabours([]); }}
                      min={new Date().toISOString().split("T")[0]} />
                  </div>

                  {/* Slot */}
                  <div>
                    <label style={A.label}>Time Slot</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {Object.entries(SLOT_CFG).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <motion.button key={key} type="button"
                            style={{
                              ...A.slotBtn,
                              backgroundColor: bSlot === key ? cfg.color : "#f9fafb",
                              color: bSlot === key ? "#fff" : "#6b7280",
                              border: `1.5px solid ${bSlot === key ? cfg.color : "#e5e7eb"}`,
                            }}
                            onClick={() => { setBSlot(key); setBSelectedLabours([]); }}
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Icon size={13} /> {cfg.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Work Type */}
                  <div>
                    <label style={A.label}>Work Type</label>
                    <select style={A.minput} value={bWorkType} onChange={e => setBWorkType(e.target.value)}>
                      {["🌾 Harvesting","🌱 Planting","🌿 Weeding","💧 Irrigation","🧴 Spraying","🚜 Tilling","📦 Loading","📝 Other"].map(w => (
                        <option key={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  {/* Address */}
                  <div>
                    <label style={A.label}>Farm Address</label>
                    <input style={A.minput} type="text" placeholder="Full address..."
                      value={bAddress} onChange={e => setBAddress(e.target.value)} />
                  </div>

                  {/* Landmark */}
                  <div>
                    <label style={A.label}>Landmark</label>
                    <input style={A.minput} type="text" placeholder="Near Shiva temple..."
                      value={bLandmark} onChange={e => setBLandmark(e.target.value)} />
                  </div>
                </div>

                {/* Labour selection */}
                {bDate && bSupervisorId && (
                  <div style={{ marginTop: "20px" }}>
                    <label style={A.label}>
                      Select Labours — {availForAdminBook.length} available for {SLOT_CFG[bSlot]?.label} on {bDate}
                    </label>
                    {availForAdminBook.length === 0 ? (
                      <div style={A.warnBox}>⚠️ No labours available for this supervisor on this date & slot.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "8px", marginTop: "8px" }}>
                        {availForAdminBook.map(l => {
                          const isSel = bSelectedLabours.includes(l.id);
                          return (
                            <motion.div key={l.id}
                              style={{
                                ...A.labourSelectCard,
                                backgroundColor: isSel ? "#f0fdf4" : "#f9fafb",
                                border: `1.5px solid ${isSel ? "#16a34a" : "#e5e7eb"}`,
                              }}
                              onClick={() => setBSelectedLabours(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: isSel ? "#16a34a" : "#d1d5db" }} />
                                <div>
                                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>{l.name}</p>
                                  <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>{l.phone}</p>
                                </div>
                              </div>
                              {isSel && <span style={{ color: "#16a34a", fontSize: "16px" }}>✓</span>}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Cost preview */}
                {bSelectedLabours.length > 0 && (
                  <div style={A.costPreview}>
                    <span>{bSelectedLabours.length} labours × ₹{SLOT_CFG[bSlot]?.rate} = </span>
                    <span style={{ fontWeight: 900, color: "#166534", fontSize: "18px" }}>
                      ₹{(bSelectedLabours.length * (SLOT_CFG[bSlot]?.rate || 300)).toLocaleString()}
                    </span>
                  </div>
                )}

                <motion.button style={{
                    ...A.greenBtn, marginTop: "20px", padding: "14px 28px",
                    fontSize: "15px", opacity: loading ? 0.6 : 1,
                  }}
                  onClick={handleAdminBook} disabled={loading}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  {loading ? "Creating..." : `✅ Create & Assign Booking`}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── SUPERVISORS ── */}
          {activeTab === "supervisors" && (
            <motion.div key="supervisors"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>Supervisors</h1>
                  <p style={A.pageSub}>{supervisors.length} registered supervisors</p>
                </div>
                <motion.button style={A.greenBtn} onClick={() => setAddSupModal(true)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <UserPlus size={14} /> Add Supervisor
                </motion.button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {supervisors.map(sup => {
                  const supLabours   = allLabours.filter(l => l.supervisorId === sup.id);
                  const supAssigned  = allBookings.filter(b => b.supervisorId === sup.id && b.status === "assigned");
                  const onLeaveToday = supLabours.filter(l =>
                    Object.keys(l.unavailability || {}).some(k => k.startsWith(today))
                  );
                  return (
                    <motion.div key={sup.id} style={A.personCard} whileHover={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
                        <div style={{ ...A.avatar, backgroundColor: "#eff6ff", color: "#1d4ed8", border: "2px solid #bfdbfe" }}>
                          {sup.name?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "15px", fontWeight: 800, color: "#1f2937" }}>{sup.name}</span>
                            <span style={{ ...A.badge, backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>Supervisor</span>
                          </div>
                          <div style={{ display: "flex", gap: "16px", marginTop: "4px", flexWrap: "wrap" }}>
                            <span style={A.meta}><Phone size={11} color="#9ca3af" /> {sup.phone}</span>
                            <span style={A.meta}><Users size={11} color="#9ca3af" /> {supLabours.length} labours</span>
                            <span style={A.meta}><ClipboardList size={11} color="#9ca3af" /> {supAssigned.length} active jobs</span>
                            {onLeaveToday.length > 0 && (
                              <span style={{ ...A.meta, color: "#dc2626" }}>🚫 {onLeaveToday.length} on leave today</span>
                            )}
                          </div>

                          {/* Labours under this supervisor */}
                          {supLabours.length > 0 && (
                            <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {supLabours.map(l => {
                                const busyToday = allBookings.some(b =>
                                  b.status === "assigned" && b.date === today &&
                                  b.assignedLabourIds?.includes(l.id)
                                );
                                const onLeave = Object.keys(l.unavailability || {}).some(k => k.startsWith(today));
                                return (
                                  <span key={l.id} style={{
                                    fontSize: "11px", padding: "3px 9px", borderRadius: "10px", fontWeight: 600,
                                    backgroundColor: onLeave ? "#fef2f2" : busyToday ? "#fffbeb" : "#f0fdf4",
                                    color:           onLeave ? "#dc2626" : busyToday ? "#92400e" : "#15803d",
                                    border: `1px solid ${onLeave ? "#fecaca" : busyToday ? "#fde68a" : "#bbf7d0"}`,
                                    cursor: "pointer",
                                  }}
                                    onClick={() => setDetailModal({ type: "labour", data: l })}>
                                    {onLeave ? "🚫" : busyToday ? "⏳" : "✅"} {l.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button style={A.viewBtn} onClick={() => setDetailModal({ type: "supervisor", data: sup })}>
                          <Eye size={12} /> Details
                        </button>
                        <button style={A.deleteBtn} onClick={() => handleDeleteSupervisor(sup.id, sup.name)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
                {supervisors.length === 0 && <div style={A.emptyCard}><p style={A.emptyText}>No supervisors yet. Add one!</p></div>}
              </div>
            </motion.div>
          )}

          {/* ── LABOURS ── */}
          {activeTab === "labours" && (
            <motion.div key="labours"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>All Labours</h1>
                  <p style={A.pageSub}>{allLabours.length} total · {allLabours.filter(l => !Object.keys(l.unavailability || {}).some(k => k.startsWith(today))).length} available today</p>
                </div>
                <motion.button style={A.greenBtn} onClick={() => setAddLabourModal(true)}
                  whileHover={{ scale: 1.03 }}>
                  <Plus size={14} /> Add Labour
                </motion.button>
              </div>

              {supervisors.map(sup => {
                const supLabours = allLabours.filter(l => l.supervisorId === sup.id);
                if (supLabours.length === 0) return null;
                return (
                  <div key={sup.id} style={A.section}>
                    <div style={A.sectionHeader}>
                      <div style={{ ...A.avatar, width: "28px", height: "28px", fontSize: "12px", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #bfdbfe" }}>
                        {sup.name[0]}
                      </div>
                      <span style={A.sectionTitle}>{sup.name}'s Team ({supLabours.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {supLabours.map(l => {
                        const busyToday = allBookings.some(b =>
                          b.status === "assigned" && b.date === today &&
                          b.assignedLabourIds?.includes(l.id)
                        );
                        const todayLeaveKeys = Object.keys(l.unavailability || {}).filter(k => k.startsWith(today));
                        return (
                          <div key={l.id} style={A.labourRow}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                              <div style={{ ...A.avatar, width: "32px", height: "32px", fontSize: "12px", backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#6b7280" }}>
                                {l.name[0]}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>{l.name}</span>
                                  {busyToday && <span style={{ ...A.badge, backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>Assigned Today</span>}
                                  {todayLeaveKeys.length > 0 && <span style={{ ...A.badge, backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>On Leave</span>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                  <Phone size={11} color="#9ca3af" />
                                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>{l.phone}</span>
                                  {todayLeaveKeys.map(key => {
                                    const [, s] = key.split("_");
                                    return <span key={key} style={{ fontSize: "10px", color: "#dc2626", marginLeft: "8px" }}>🚫 {SLOT_CFG[s]?.label}</span>;
                                  })}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button style={A.viewBtn} onClick={() => setDetailModal({ type: "labour", data: l })}>
                                <Eye size={12} /> Details
                              </button>
                              <button style={A.deleteBtn} onClick={() => handleDeleteLabour(l.id, l.name)}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {allLabours.length === 0 && <div style={A.emptyCard}><p style={A.emptyText}>No labours added yet.</p></div>}
            </motion.div>
          )}

          {/* ── FARMERS ── */}
          {activeTab === "farmers" && (
            <motion.div key="farmers"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>Farmers</h1>
                  <p style={A.pageSub}>{farmers.length} registered farmers</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {farmers.map(f => {
                  const fBookings = allBookings.filter(b => b.farmerId === f.id);
                  const totalSpent = fBookings.reduce((s, b) => s + (b.totalCost || 0), 0);
                  return (
                    <motion.div key={f.id} style={A.personCard} whileHover={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
                        <div style={{ ...A.avatar, backgroundColor: "#f0fdf4", color: "#15803d", border: "2px solid #bbf7d0" }}>
                          {f.name?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "15px", fontWeight: 800, color: "#1f2937" }}>{f.name}</span>
                          <div style={{ display: "flex", gap: "16px", marginTop: "4px", flexWrap: "wrap" }}>
                            <span style={A.meta}><Phone size={11} color="#9ca3af" /> {f.phone}</span>
                            <span style={A.meta}><MapPin size={11} color="#9ca3af" /> {f.village}</span>
                            <span style={A.meta}><ClipboardList size={11} color="#9ca3af" /> {fBookings.length} bookings</span>
                            <span style={{ ...A.meta, color: "#166534", fontWeight: 700 }}>₹{totalSpent.toLocaleString()} spent</span>
                            {f.cropType && (
                              <span style={A.meta}>🌾 {Array.isArray(f.cropType) ? f.cropType.join(", ") : f.cropType}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button style={A.viewBtn} onClick={() => setDetailModal({ type: "farmer", data: f })}>
                        <Eye size={12} /> Details
                      </button>
                    </motion.div>
                  );
                })}
                {farmers.length === 0 && <div style={A.emptyCard}><p style={A.emptyText}>No farmers registered yet.</p></div>}
              </div>
            </motion.div>
          )}

          {/* ── FINANCE ── */}
          {activeTab === "finance" && (
            <motion.div key="finance"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>Finance</h1>
                  <p style={A.pageSub}>Revenue, expenses and salary overview</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "24px" }}>
                {[
                  { label: "Revenue from Farmers",   value: totalRevenue,   color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", icon: "💰" },
                  { label: "Labour Salaries / month", value: labourSalaries, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "👷" },
                  { label: "Supervisor Salaries / month", value: supSalaries, color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", icon: "👨‍💼" },
                ].map(c => (
                  <div key={c.label} style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}`, borderRadius: "16px", padding: "24px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{c.icon}</div>
                    <div style={{ fontSize: "28px", fontWeight: 900, color: c.color }}>₹{c.value.toLocaleString()}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", fontWeight: 600 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#1f2937", marginBottom: "16px" }}>Monthly Salary Breakdown</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "13px", color: "#6b7280" }}>{allLabours.length} Labours × ₹{LABOUR_MONTHLY.toLocaleString()}/month</span>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#dc2626" }}>₹{labourSalaries.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "13px", color: "#6b7280" }}>{supervisors.length} Supervisors × ₹{SUP_MONTHLY.toLocaleString()}/month</span>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#1d4ed8" }}>₹{supSalaries.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>Total Monthly Expenses</span>
                    <span style={{ fontSize: "15px", fontWeight: 900, color: "#dc2626" }}>₹{totalExpenses.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>Net Profit (Revenue − Monthly Expenses)</span>
                    <span style={{ fontSize: "18px", fontWeight: 900, color: totalRevenue - totalExpenses >= 0 ? "#166534" : "#dc2626" }}>
                      ₹{(totalRevenue - totalExpenses).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Per-farmer revenue */}
              <div style={A.section}>
                <div style={A.sectionHeader}>
                  <span style={A.sectionTitle}>Revenue per Farmer</span>
                </div>
                {farmers.map(f => {
                  const spent = allBookings.filter(b => b.farmerId === f.id && (b.status === "assigned" || b.status === "completed")).reduce((s, b) => s + (b.totalCost || 0), 0);
                  const bookingCount = allBookings.filter(b => b.farmerId === f.id).length;
                  return (
                    <div key={f.id} style={A.row}>
                      <div>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1f2937" }}>{f.name}</span>
                        <span style={{ fontSize: "12px", color: "#9ca3af", marginLeft: "10px" }}>{bookingCount} bookings</span>
                      </div>
                      <span style={{ fontSize: "15px", fontWeight: 800, color: "#166534" }}>₹{spent.toLocaleString()}</span>
                    </div>
                  );
                })}
                {farmers.length === 0 && <p style={A.emptyText}>No farmers yet.</p>}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

// ── STYLES (Light Theme) ──
const A = {
  root: {
    minHeight: "100vh", backgroundColor: "#f8fafc",
    display: "flex", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#1f2937",
  },

  // Modals
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "85vh", overflowY: "auto" },
  modalTitle: { fontSize: "18px", fontWeight: 800, color: "#1f2937", margin: "0 0 16px" },
  label: { display: "block", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" },
  minput: { width: "100%", padding: "10px 13px", backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "9px", fontSize: "14px", color: "#1f2937", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  greenBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", backgroundColor: "#166534", border: "none", borderRadius: "10px", color: "#ffffff", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  cancelBtn: { padding: "10px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#dc2626", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  detailRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f3f4f6" },
  detailKey: { fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px" },
  detailVal: { fontSize: "13px", fontWeight: 600, color: "#1f2937" },

  // Sidebar
  sidebar: { width: "220px", minHeight: "100vh", backgroundColor: "#ffffff", borderRight: "1px solid #e5e7eb", padding: "20px 0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0, boxShadow: "2px 0 12px rgba(0,0,0,0.04)" },
  sidebarTop: { display: "flex", alignItems: "center", gap: "10px", padding: "0 16px 20px", borderBottom: "1px solid #f3f4f6" },
  logoMark: { width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#166534,#15803d)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(22,101,52,0.3)" },
  logoTitle: { fontSize: "15px", fontWeight: 800, color: "#1f2937" },
  logoSub: { fontSize: "10px", color: "#9ca3af", fontWeight: 500 },
  navBtn: { width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "9px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", marginBottom: "2px", transition: "all 0.2s" },
  redBadge: { marginLeft: "auto", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "10px" },
  sidebarBottom: { padding: "16px", marginTop: "auto" },
  logoutBtn: { display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", width: "100%" },

  // Main
  main: { flex: 1, padding: "28px", overflowY: "auto", minHeight: "100vh" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" },
  pageTitle: { fontSize: "22px", fontWeight: 900, color: "#1f2937", margin: 0, letterSpacing: "-0.5px" },
  pageSub: { fontSize: "13px", color: "#9ca3af", margin: "3px 0 0" },

  // KPIs
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "12px", marginBottom: "16px" },
  kpiCard: { borderRadius: "14px", padding: "18px 14px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" },

  // Revenue strip
  revenueStrip: { backgroundColor: "#ffffff", border: "1.5px solid #e5e7eb", borderRadius: "14px", padding: "20px 24px", display: "flex", gap: "0", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  revItem: { flex: 1, textAlign: "center" },
  revDivider: { width: "1px", backgroundColor: "#f3f4f6", margin: "0 20px" },

  // Sections
  section: { backgroundColor: "#ffffff", border: "1.5px solid #e5e7eb", borderRadius: "14px", padding: "18px", marginBottom: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  sectionHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" },
  sectionTitle: { fontSize: "13px", fontWeight: 800, color: "#1f2937", textTransform: "uppercase", letterSpacing: "0.4px" },
  greenDot: { width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e", boxShadow: "0 0 0 3px #dcfce7" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f9fafb", borderRadius: "8px", marginBottom: "6px", border: "1px solid #f3f4f6" },
  emptyText: { color: "#9ca3af", fontSize: "13px", textAlign: "center", padding: "20px 0" },
  emptyCard: { backgroundColor: "#ffffff", border: "1.5px solid #e5e7eb", borderRadius: "14px", padding: "40px" },

  // Booking cards
  bookingCard: { backgroundColor: "#ffffff", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.2s" },
  bInfoCell: { display: "flex", alignItems: "center", gap: "5px" },
  badge: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700 },
  viewBtn: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "7px", fontSize: "12px", fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" },
  deleteBtn: { padding: "6px 9px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", fontFamily: "inherit" },
  holidayChip: { backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "20px" },

  // Person cards
  personCard: { backgroundColor: "#ffffff", border: "1.5px solid #e5e7eb", borderRadius: "14px", padding: "16px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.2s" },
  avatar: { width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, flexShrink: 0 },
  meta: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#9ca3af" },

  // Labour row
  labourRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f9fafb", borderRadius: "10px", border: "1px solid #f3f4f6" },

  // Form
  formCard: { backgroundColor: "#ffffff", border: "1.5px solid #e5e7eb", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  slotBtn: { display: "flex", alignItems: "center", gap: "5px", padding: "9px 14px", borderRadius: "8px", cursor: "pointer", border: "none", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" },
  labourSelectCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", transition: "all 0.2s" },
  warnBox: { backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px 14px", fontSize: "13px", color: "#92400e", fontWeight: 600, marginTop: "8px" },
  costPreview: { backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: "10px", padding: "12px 16px", marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px", color: "#374151", fontWeight: 600 },
};