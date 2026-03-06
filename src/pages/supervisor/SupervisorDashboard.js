import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection, query, where, doc, getDoc,
  onSnapshot, updateDoc, addDoc, deleteDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Leaf, LogOut, Users, ClipboardList, CheckSquare,
  Plus, Trash2, Phone, Calendar, Clock, MapPin,
  FileText, Sun, Sunset, Sunrise, User,
  AlertCircle, CheckCircle2, XCircle, CheckCheck, Menu, X,
} from "lucide-react";

const SLOT_CONFIG = {
  "8-12":  { label: "Morning",   time: "8AM–12PM", icon: Sunrise, color: "#d97706", rate: 300 },
  "2-6":   { label: "Afternoon", time: "2PM–6PM",  icon: Sunset,  color: "#ea580c", rate: 300 },
  fullday: { label: "Full Day",  time: "8AM–6PM",  icon: Sun,     color: "#16a34a", rate: 600 },
};

// Hook to detect screen size
function useBreakpoint() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return { isMobile: width < 768, isTablet: width >= 768 && width < 1024, isDesktop: width >= 1024 };
}

export default function SupervisorDashboard() {
  const [supData,           setSupData]           = useState(null);
  const [myLabours,         setMyLabours]         = useState([]);
  const [allBookings,       setAllBookings]       = useState([]);
  const [activeTab,         setActiveTab]         = useState("requests");
  const [loading,           setLoading]           = useState(false);
  const [newName,           setNewName]           = useState("");
  const [newPhone,          setNewPhone]          = useState("");
  const [assignModal,       setAssignModal]       = useState(null);
  const [selectedLabourIds, setSelectedLabourIds] = useState([]);
  const [unavailModal,      setUnavailModal]      = useState(null);
  const [unavailDate,       setUnavailDate]       = useState("");
  const [unavailSlot,       setUnavailSlot]       = useState("8-12");
  const [unavailReason,     setUnavailReason]     = useState("");
  const [sidebarOpen,       setSidebarOpen]       = useState(true);

  const navigate    = useNavigate();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { navigate("/login"); return; }

    getDoc(doc(db, "users", user.uid)).then(d => {
      if (d.exists()) setSupData({ id: user.uid, ...d.data() });
    });

    const lq = query(collection(db, "labours"), where("supervisorId", "==", user.uid));
    const u1 = onSnapshot(lq, snap => {
      setMyLabours(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(collection(db, "bookings"), snap => {
      setAllBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { u1(); u2(); };
  }, [navigate]);

  // Close sidebar on tab change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [activeTab, isMobile]);

  const isLabourAvailableForSlot = (labour, date, slot) => {
    const unavailKey = `${date}_${slot}`;
    if (labour.unavailability?.[unavailKey]) return false;
    if (slot === "fullday") {
      if (labour.unavailability?.[`${date}_8-12`]) return false;
      if (labour.unavailability?.[`${date}_2-6`])  return false;
    }
    const busy = allBookings.some(b => {
      if (b.status !== "assigned" && b.status !== "completed") return false;
      if (b.date !== date) return false;
      if (!b.assignedLabourIds?.includes(labour.id)) return false;
      return b.timeSlot === slot || b.timeSlot === "fullday" || slot === "fullday";
    });
    return !busy;
  };

  const getAvailableForSlot = (date, slot) => {
    if (!date || !slot) return myLabours.length;
    return myLabours.filter(l => isLabourAvailableForSlot(l, date, slot)).length;
  };

  const pendingBookings = allBookings.filter(b => b.status === "pending");
  const myAssigned      = allBookings.filter(b => b.supervisorId === auth.currentUser?.uid && b.status === "assigned");
  const myCompleted     = allBookings.filter(b =>
    b.supervisorId === auth.currentUser?.uid &&
    b.farmerConfirmed === true &&
    b.supervisorConfirmed === true
  );

  const handleAddLabour = async (e) => {
    e.preventDefault();
    if (!newName.trim())        { toast.error("Enter labour name!");          return; }
    if (newPhone.length !== 10) { toast.error("Enter valid 10 digit phone!"); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, "labours"), {
        name: newName.trim(), phone: newPhone,
        supervisorId: supData.id, supervisorName: supData.name,
        available: true, unavailability: {}, attendanceMarked: false, createdAt: new Date(),
      });
      await updateDoc(doc(db, "users", supData.id), { labourCount: myLabours.length + 1 });
      toast.success(`${newName} added! ✅`);
      setNewName(""); setNewPhone("");
    } catch { toast.error("Failed to add labour."); }
    setLoading(false);
  };

  const handleDeleteLabour = async (labourId, name) => {
    if (!window.confirm(`Remove ${name} from your team?`)) return;
    try {
      await deleteDoc(doc(db, "labours", labourId));
      toast.success(`${name} removed.`);
    } catch { toast.error("Failed to remove."); }
  };

  const handleMarkUnavailable = async () => {
    if (!unavailDate) { toast.error("Select a date!"); return; }
    try {
      const key     = `${unavailDate}_${unavailSlot}`;
      const updated = { ...(unavailModal.unavailability || {}), [key]: unavailReason || "Personal reason" };
      await updateDoc(doc(db, "labours", unavailModal.id), { unavailability: updated });
      toast.success("Marked unavailable ✅");
      setUnavailModal(null); setUnavailDate(""); setUnavailReason("");
    } catch { toast.error("Failed to update."); }
  };

  const handleRemoveUnavailability = async (labourId, key) => {
    const labour  = myLabours.find(l => l.id === labourId);
    const updated = { ...(labour.unavailability || {}) };
    delete updated[key];
    await updateDoc(doc(db, "labours", labourId), { unavailability: updated });
    toast.success("Availability restored ✅");
  };

  const handleAssign = async () => {
    if (!assignModal) return;
    if (selectedLabourIds.length === 0)                     { toast.error("Select at least 1 labour!"); return; }
    if (selectedLabourIds.length > assignModal.labourCount) { toast.error(`Farmer needs only ${assignModal.labourCount} labours!`); return; }
    setLoading(true);
    try {
      const selected = myLabours.filter(l => selectedLabourIds.includes(l.id));
      const names    = selected.map(l => l.name);
      await updateDoc(doc(db, "bookings", assignModal.id), {
        status: "assigned",
        supervisorId: supData.id, supervisorName: supData.name, supervisorPhone: supData.phone,
        assignedLabour: selectedLabourIds.length,
        assignedLabourIds: selectedLabourIds, assignedLabourNames: names,
      });
      toast.success(`${names.join(", ")} assigned to ${assignModal.farmerName}! ✅`);
      setAssignModal(null); setSelectedLabourIds([]);
    } catch { toast.error("Failed to assign."); }
    setLoading(false);
  };

  const handleConfirmAttendance = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { supervisorConfirmed: true });
      toast.success("Attendance confirmed! ✅");
    } catch { toast.error("Failed to confirm."); }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };
  const toggleLabour = (id) => setSelectedLabourIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const NAV = [
    { id: "requests",  icon: ClipboardList, label: "Farm Requests",   badge: pendingBookings.length, badgeClr: "#d97706" },
    { id: "pending",   icon: Clock,         label: "Pending",          badge: myAssigned.length,      badgeClr: "#2563eb" },
    { id: "completed", icon: CheckCheck,    label: "Completed",        badge: myCompleted.length,     badgeClr: "#16a34a" },
    { id: "labours",   icon: Users,         label: "My Labours",       badge: myLabours.length,       badgeClr: "#7c3aed" },
  ];

  // Whether sidebar should be shown as overlay (mobile/tablet) or permanent (desktop)
  const showSidebarOverlay = !isDesktop && sidebarOpen;
  const showSidebarPermanent = isDesktop;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;}
        input,textarea,button{font-family:'DM Sans',sans-serif;}
        input[type="date"]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:.5;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#f1f5f9;}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}
        @media (max-width: 767px) {
          .main-content { padding: 16px 14px 90px !important; }
          .page-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .card-top { flex-direction: column !important; align-items: flex-start !important; }
          .form-row { flex-direction: column !important; }
          .modal-inner { padding: 20px 16px !important; }
          .labour-card-actions { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .stats-box { margin: 0 8px 12px !important; }
          .slot-pills { flex-wrap: wrap !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .main-content { padding: 22px 20px 90px !important; }
        }
      `}</style>
      <Toaster position="top-right" toastOptions={{ style: { fontFamily: "'DM Sans',sans-serif", fontSize: "13px" } }} />

      {/* ── MOBILE TOP BAR ── */}
      {!isDesktop && (
        <div style={S.topBar}>
          <button style={S.menuBtn} onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? <X size={20} color="#1e293b" /> : <Menu size={20} color="#1e293b" />}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={S.logoIconSm}><Leaf size={14} color="#16a34a" /></div>
            <span style={S.topBarTitle}>KrishiSetu</span>
          </div>
          {supData && (
            <div style={S.topBarAvatar}>{supData.name?.[0]?.toUpperCase()}</div>
          )}
        </div>
      )}

      {/* ── SIDEBAR OVERLAY (mobile/tablet) ── */}
      <AnimatePresence>
        {showSidebarOverlay && (
          <>
            <motion.div
              style={S.sidebarBackdrop}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside style={{ ...S.sidebar, ...S.sidebarOverlay }}
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <SidebarContent
                supData={supData} myLabours={myLabours} myAssigned={myAssigned}
                activeTab={activeTab} setActiveTab={setActiveTab}
                NAV={NAV} handleLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── SIDEBAR PERMANENT (desktop) ── */}
      {showSidebarPermanent && (
        <motion.aside
          animate={{ width: sidebarOpen ? 252 : 64 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          style={{ ...S.sidebar, width: sidebarOpen ? 252 : 64, overflow: "hidden" }}>
          <SidebarContent
            supData={supData} myLabours={myLabours} myAssigned={myAssigned}
            activeTab={activeTab} setActiveTab={setActiveTab}
            NAV={NAV} handleLogout={handleLogout}
            collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(v => !v)}
          />
        </motion.aside>
      )}

      {/* ── MAIN ── */}
      <main style={S.main} className="main-content">

        {/* ── UNAVAILABILITY MODAL ── */}
        <AnimatePresence>
          {unavailModal && (
            <motion.div style={S.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div style={S.modal} className="modal-inner" initial={{ scale: 0.94, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}>
                <div style={S.modalHeader}>
                  <div style={{ ...S.modalIconWrap, background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <XCircle size={18} color="#ef4444" />
                  </div>
                  <div>
                    <h3 style={S.modalTitle}>Mark Unavailable</h3>
                    <p style={S.modalSub}>👤 {unavailModal.name}</p>
                  </div>
                </div>

                <label style={S.label}>Date</label>
                <input style={S.input} type="date" value={unavailDate}
                  onChange={e => setUnavailDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} />

                <label style={{ ...S.label, marginTop: "14px" }}>Time Slot</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }} className="slot-pills">
                  {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
                    const Icon   = cfg.icon;
                    const active = unavailSlot === key;
                    return (
                      <motion.button key={key} type="button"
                        style={{ ...S.slotPill, backgroundColor: active ? cfg.color : "#f8fafc", border: `1.5px solid ${active ? cfg.color : "#e2e8f0"}`, color: active ? "#fff" : "#64748b" }}
                        onClick={() => setUnavailSlot(key)} whileHover={{ scale: 1.03 }}>
                        <Icon size={12} />{cfg.label}
                      </motion.button>
                    );
                  })}
                </div>

                <label style={S.label}>Reason (optional)</label>
                <input style={S.input} type="text" placeholder="Personal reason, illness..."
                  value={unavailReason} onChange={e => setUnavailReason(e.target.value)} />

                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <motion.button style={S.modalConfirmBtn} onClick={handleMarkUnavailable} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Confirm</motion.button>
                  <motion.button style={S.modalCancelBtn} onClick={() => setUnavailModal(null)} whileHover={{ scale: 1.02 }}>Cancel</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ASSIGN MODAL ── */}
        <AnimatePresence>
          {assignModal && (
            <motion.div style={S.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div style={{ ...S.modal, maxWidth: "500px" }} className="modal-inner" initial={{ scale: 0.94, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}>
                <div style={S.modalHeader}>
                  <div style={{ ...S.modalIconWrap, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                    <Users size={18} color="#2563eb" />
                  </div>
                  <div>
                    <h3 style={S.modalTitle}>Assign Labour</h3>
                    <p style={S.modalSub}>{assignModal.farmerName} · {assignModal.date}</p>
                  </div>
                </div>

                <div style={S.assignInfo}>
                  {[
                    [Calendar, "#16a34a", assignModal.date],
                    [SLOT_CONFIG[assignModal.timeSlot]?.icon || Clock, SLOT_CONFIG[assignModal.timeSlot]?.color, `${SLOT_CONFIG[assignModal.timeSlot]?.label} · ${SLOT_CONFIG[assignModal.timeSlot]?.time}`],
                    [Users,  "#2563eb", `${assignModal.farmerName} needs ${assignModal.labourCount} labours`],
                    [MapPin, "#94a3b8", assignModal.farmAddress || assignModal.village],
                  ].map(([Icon, color, text], i) => (
                    <div key={i} style={S.assignInfoRow}>
                      <Icon size={13} color={color} /><span>{text}</span>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
                  Selected: <span style={{ color: "#2563eb", fontWeight: 700 }}>{selectedLabourIds.length}</span> / {assignModal.labourCount} needed
                </p>

                <p style={S.sectionLabel}>✅ Available Labours</p>
                <div style={{ maxHeight: "210px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                  {myLabours.filter(l => isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).length === 0
                    ? <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No available labours for this slot!</p>
                    : myLabours.filter(l => isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).map(l => {
                        const isSel = selectedLabourIds.includes(l.id);
                        return (
                          <motion.div key={l.id}
                            style={{ ...S.labourSelectRow, backgroundColor: isSel ? "#eff6ff" : "#f8fafc", border: `1.5px solid ${isSel ? "#2563eb" : "#e2e8f0"}` }}
                            onClick={() => toggleLabour(l.id)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: isSel ? "#2563eb" : "#cbd5e1" }} />
                              <div>
                                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: isSel ? "#1e40af" : "#475569" }}>👤 {l.name}</p>
                                <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>📞 {l.phone}</p>
                              </div>
                            </div>
                            {isSel && <CheckCircle2 size={16} color="#2563eb" />}
                          </motion.div>
                        );
                      })
                  }
                </div>

                {myLabours.filter(l => !isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).length > 0 && (
                  <>
                    <p style={{ ...S.sectionLabel, color: "#ef4444" }}>⏳ Busy / Unavailable</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "12px", opacity: 0.5 }}>
                      {myLabours.filter(l => !isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).map(l => (
                        <div key={l.id} style={{ ...S.labourSelectRow, cursor: "default" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#fca5a5" }} />
                            <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>👤 {l.name}</p>
                          </div>
                          <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>Unavailable</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <motion.button style={{ ...S.modalConfirmBtn, opacity: selectedLabourIds.length === 0 ? 0.45 : 1 }}
                    onClick={handleAssign} disabled={loading || selectedLabourIds.length === 0}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    {loading ? "Assigning..." : `✅ Assign ${selectedLabourIds.length} Labours`}
                  </motion.button>
                  <motion.button style={S.modalCancelBtn}
                    onClick={() => { setAssignModal(null); setSelectedLabourIds([]); }}
                    whileHover={{ scale: 1.02 }}>Cancel</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ───── FARM REQUESTS ───── */}
          {activeTab === "requests" && (
            <motion.div key="requests" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <PageHeader
                title="Farm Requests"
                sub={`${pendingBookings.length} pending requests awaiting assignment`}
                badge={{ bg: "#fef3c7", color: "#d97706", border: "#fde68a", Icon: AlertCircle, label: `${pendingBookings.length} Pending` }}
              />
              {pendingBookings.length === 0
                ? <EmptyState icon="📭" title="No pending requests" sub="New farm bookings will appear here" />
                : (
                  <div style={S.list}>
                    {pendingBookings.sort((a, b) => new Date(a.date) - new Date(b.date)).map((booking, i) => {
                      const slotCfg      = SLOT_CONFIG[booking.timeSlot];
                      const SlotIcon     = slotCfg?.icon || Clock;
                      const availForSlot = getAvailableForSlot(booking.date, booking.timeSlot);
                      const canAssign    = availForSlot >= booking.labourCount;
                      return (
                        <motion.div key={booking.id} style={S.card}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(0,0,0,0.08)" }}>

                          <div style={S.cardTop} className="card-top">
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                              <Pill bg="#f0fdf4" color="#16a34a" border="#bbf7d0"><Calendar size={10} />{booking.date}</Pill>
                              <Pill bg={`${slotCfg?.color}18`} color={slotCfg?.color} border={`${slotCfg?.color}50`}><SlotIcon size={10} />{slotCfg?.label}</Pill>
                              <Pill bg="#fef3c7" color="#d97706" border="#fde68a">Pending</Pill>
                            </div>
                            <span style={S.cost}>₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}</span>
                          </div>

                          <div style={S.grid2} className="grid-2">
                            {[
                              [User,    "",               booking.farmerName],
                              [Phone,   "",               booking.farmerPhone],
                              [Users,   "",               `${booking.labourCount} labours needed`],
                              [SlotIcon, slotCfg?.color,  slotCfg?.time],
                              [MapPin,  "",               booking.farmAddress || booking.village],
                              ...(booking.workType ? [[FileText, "", booking.workType]] : []),
                            ].map(([Icon, clr, txt], j) => (
                              <div key={j} style={S.detail}><Icon size={12} color={clr || "#94a3b8"} /><span>{txt}</span></div>
                            ))}
                          </div>

                          <div style={{ ...S.availChip, backgroundColor: canAssign ? "#f0fdf4" : "#fef2f2", border: `1px solid ${canAssign ? "#bbf7d0" : "#fecaca"}` }}>
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: canAssign ? "#16a34a" : "#ef4444", flexShrink: 0 }} />
                            <span style={{ color: canAssign ? "#15803d" : "#dc2626", fontSize: "12px", fontWeight: 600 }}>
                              {availForSlot} of your labours available for this slot
                            </span>
                          </div>

                          <motion.button
                            style={{ ...S.actionBtn, backgroundColor: canAssign ? "#16a34a" : "#e2e8f0", color: canAssign ? "#fff" : "#94a3b8", cursor: canAssign ? "pointer" : "not-allowed" }}
                            onClick={() => { if (!canAssign) { toast.error(`Not enough labours! Only ${availForSlot} available.`); return; } setAssignModal(booking); setSelectedLabourIds([]); }}
                            whileHover={{ scale: canAssign ? 1.02 : 1 }} whileTap={{ scale: canAssign ? 0.97 : 1 }}>
                            <Users size={14} />
                            {canAssign ? "Select & Assign Labours" : `Need ${booking.labourCount}, only ${availForSlot} available`}
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
            </motion.div>
          )}

          {/* ───── PENDING ASSIGNMENTS ───── */}
          {activeTab === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <PageHeader
                title="Pending Assignments"
                sub={`${myAssigned.length} active assignments in progress`}
                badge={{ bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", Icon: Clock, label: `${myAssigned.length} Active` }}
              />
              {myAssigned.length === 0
                ? <EmptyState icon="📋" title="No active assignments" sub="Assigned bookings awaiting completion will appear here" />
                : (
                  <div style={S.list}>
                    {myAssigned.sort((a, b) => new Date(a.date) - new Date(b.date)).map((booking, i) => {
                      const slotCfg      = SLOT_CONFIG[booking.timeSlot];
                      const SlotIcon     = slotCfg?.icon || Clock;
                      const presentCount = Object.values(booking.labourAttendance || {}).filter(Boolean).length;
                      const absentCount  = (booking.assignedLabour || 0) - presentCount;
                      return (
                        <motion.div key={booking.id} style={S.card}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(0,0,0,0.08)" }}>

                          <div style={S.cardTop} className="card-top">
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                              <Pill bg="#f0fdf4" color="#16a34a" border="#bbf7d0"><Calendar size={10} />{booking.date}</Pill>
                              <Pill bg={`${slotCfg?.color}18`} color={slotCfg?.color} border={`${slotCfg?.color}50`}><SlotIcon size={10} />{slotCfg?.label}</Pill>
                              <Pill bg="#eff6ff" color="#2563eb" border="#bfdbfe"><CheckCircle2 size={10} />Assigned</Pill>
                            </div>
                            <span style={S.cost}>₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}</span>
                          </div>

                          <div style={S.grid2} className="grid-2">
                            {[
                              [User,   "", booking.farmerName],
                              [Phone,  "", booking.farmerPhone],
                              [Users,  "", `${booking.assignedLabour} assigned`],
                              [MapPin, "", booking.farmAddress || booking.village],
                              ...(booking.workType ? [[FileText, "", booking.workType]] : []),
                            ].map(([Icon, clr, txt], j) => (
                              <div key={j} style={S.detail}><Icon size={12} color={clr || "#94a3b8"} /><span>{txt}</span></div>
                            ))}
                          </div>

                          {booking.assignedLabourNames?.length > 0 && (
                            <div style={S.laboursBox}>
                              <div style={S.laboursBoxHead}>
                                <Users size={13} color="#7c3aed" />
                                <span style={{ color: "#7c3aed", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                                  Assigned Labour ({booking.assignedLabour})
                                </span>
                                <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                                  <span style={{ color: "#16a34a", fontSize: "11px", fontWeight: 700 }}>✅ {presentCount}</span>
                                  <span style={{ color: absentCount > 0 ? "#ef4444" : "#94a3b8", fontSize: "11px", fontWeight: 700 }}>❌ {absentCount}</span>
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                {booking.assignedLabourNames.map((name, idx) => {
                                  const labourId  = booking.assignedLabourIds?.[idx];
                                  const isPresent = booking.labourAttendance?.[labourId] === true;
                                  return (
                                    <div key={idx} style={{ ...S.labourRow, backgroundColor: isPresent ? "#f0fdf4" : "#f8fafc", border: `1px solid ${isPresent ? "#bbf7d0" : "#e2e8f0"}` }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: isPresent ? "#16a34a" : "#cbd5e1" }} />
                                        <span style={{ fontSize: "13px", color: isPresent ? "#15803d" : "#64748b", fontWeight: isPresent ? 600 : 400 }}>👤 {name}</span>
                                        {isPresent && <span style={S.farmerTag}>farmer confirmed</span>}
                                      </div>
                                      <span style={{ fontSize: "11px", color: isPresent ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>{isPresent ? "✅ Present" : "Pending"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {!booking.supervisorConfirmed ? (
                            <motion.button style={S.confirmBtn} onClick={() => handleConfirmAttendance(booking.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                              <CheckCircle2 size={14} /> Confirm Work Completed
                            </motion.button>
                          ) : (
                            <div style={S.confirmedRow}>
                              <CheckCircle2 size={13} color="#16a34a" />
                              <span>You confirmed attendance</span>
                              {!booking.farmerConfirmed
                                ? <span style={{ color: "#d97706", fontSize: "11px" }}>· Waiting for farmer</span>
                                : <span style={{ color: "#16a34a", fontSize: "11px" }}>· Farmer also confirmed ✅</span>}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
            </motion.div>
          )}

          {/* ───── COMPLETED ASSIGNMENTS ───── */}
          {activeTab === "completed" && (
            <motion.div key="completed" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <PageHeader
                title="Completed Assignments"
                sub={`${myCompleted.length} assignments confirmed by both farmer & supervisor`}
                badge={{ bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", Icon: CheckCheck, label: `${myCompleted.length} Done` }}
              />
              {myCompleted.length === 0
                ? <EmptyState icon="🏆" title="No completed assignments yet" sub="Assignments confirmed by both parties will appear here" />
                : (
                  <div style={S.list}>
                    {myCompleted.sort((a, b) => new Date(b.date) - new Date(a.date)).map((booking, i) => {
                      const slotCfg      = SLOT_CONFIG[booking.timeSlot];
                      const SlotIcon     = slotCfg?.icon || Clock;
                      const presentCount = Object.values(booking.labourAttendance || {}).filter(Boolean).length;
                      return (
                        <motion.div key={booking.id} style={{ ...S.card, borderLeft: "4px solid #16a34a" }}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(0,0,0,0.08)" }}>

                          <div style={S.completionBanner}>
                            <CheckCheck size={14} color="#16a34a" />
                            <span>Confirmed by both farmer &amp; supervisor</span>
                          </div>

                          <div style={S.cardTop} className="card-top">
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                              <Pill bg="#f0fdf4" color="#16a34a" border="#bbf7d0"><Calendar size={10} />{booking.date}</Pill>
                              <Pill bg={`${slotCfg?.color}18`} color={slotCfg?.color} border={`${slotCfg?.color}50`}><SlotIcon size={10} />{slotCfg?.label}</Pill>
                              <Pill bg="#f0fdf4" color="#16a34a" border="#bbf7d0"><CheckCheck size={10} />Completed</Pill>
                            </div>
                            <span style={S.cost}>₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}</span>
                          </div>

                          <div style={S.grid2} className="grid-2">
                            {[
                              [User,   "", booking.farmerName],
                              [Phone,  "", booking.farmerPhone],
                              [Users,  "", `${booking.assignedLabour} labours`],
                              [MapPin, "", booking.farmAddress || booking.village],
                              ...(booking.workType ? [[FileText, "", booking.workType]] : []),
                            ].map(([Icon, clr, txt], j) => (
                              <div key={j} style={S.detail}><Icon size={12} color={clr || "#94a3b8"} /><span>{txt}</span></div>
                            ))}
                          </div>

                          {booking.assignedLabourNames?.length > 0 && (
                            <div style={{ ...S.laboursBox, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                              <div style={S.laboursBoxHead}>
                                <Users size={13} color="#16a34a" />
                                <span style={{ color: "#15803d", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Labour Summary</span>
                                <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: "11px", fontWeight: 700 }}>
                                  ✅ {presentCount} / {booking.assignedLabour} present
                                </span>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {booking.assignedLabourNames.map((name, idx) => {
                                  const labourId  = booking.assignedLabourIds?.[idx];
                                  const isPresent = booking.labourAttendance?.[labourId] === true;
                                  return (
                                    <span key={idx} style={{ padding: "4px 11px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: isPresent ? "#dcfce7" : "#fee2e2", color: isPresent ? "#15803d" : "#dc2626", border: `1px solid ${isPresent ? "#bbf7d0" : "#fecaca"}` }}>
                                      {isPresent ? "✅" : "❌"} {name}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div style={{ ...S.confirmedRow, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                            <CheckCheck size={13} color="#16a34a" />
                            <span style={{ color: "#15803d" }}>Fully completed — both parties confirmed</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
            </motion.div>
          )}

          {/* ───── MY LABOURS ───── */}
          {activeTab === "labours" && (
            <motion.div key="labours" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <PageHeader title="My Labours" sub={`${myLabours.length} team members`} />

              <div style={{ ...S.card, marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={14} color="#2563eb" />
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Add New Labour</span>
                </div>
                <form onSubmit={handleAddLabour} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }} className="form-row">
                  <input style={{ ...S.input, flex: 2, minWidth: "140px" }} type="text" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} />
                  <input style={{ ...S.input, flex: 1, minWidth: "130px" }} type="tel" placeholder="Phone (10 digits)" value={newPhone} onChange={e => setNewPhone(e.target.value)} maxLength={10} />
                  <motion.button type="submit" style={S.addBtn} disabled={loading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Plus size={14} /> Add
                  </motion.button>
                </form>
              </div>

              {myLabours.length === 0
                ? <EmptyState icon="👥" title="No labours yet" sub="Add your first team member above" />
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {myLabours.map((labour, i) => {
                      const unavailKeys = Object.keys(labour.unavailability || {});
                      const isBusyToday = allBookings.some(b => b.status === "assigned" && b.assignedLabourIds?.includes(labour.id));
                      return (
                        <motion.div key={labour.id} style={S.labourCard}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          whileHover={{ y: -1, boxShadow: "0 4px 18px rgba(0,0,0,0.07)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1, minWidth: 0 }}>
                            <div style={S.labourAvatar}>{labour.name[0]?.toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{labour.name}</span>
                                {isBusyToday && <Pill bg="#fef3c7" color="#d97706" border="#fde68a">Assigned</Pill>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                <Phone size={11} color="#94a3b8" />
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{labour.phone}</span>
                              </div>
                              {unavailKeys.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "7px" }}>
                                  {unavailKeys.map(key => {
                                    const [d, s] = key.split("_");
                                    return (
                                      <div key={key} style={S.unavailTag}>
                                        <span>🚫 {d} · {SLOT_CONFIG[s]?.label || s}</span>
                                        <span style={{ color: "#ef4444", cursor: "pointer", marginLeft: "4px", fontWeight: 700 }}
                                          onClick={() => handleRemoveUnavailability(labour.id, key)}>×</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }} className="labour-card-actions">
                            <motion.button style={S.unavailBtn}
                              onClick={() => { setUnavailModal(labour); setUnavailDate(""); setUnavailReason(""); }}
                              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                              <XCircle size={12} /> Mark Unavailable
                            </motion.button>
                            <motion.button style={S.deleteBtn}
                              onClick={() => handleDeleteLabour(labour.id, labour.name)}
                              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                              <Trash2 size={13} />
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      {!isDesktop && (
        <nav style={S.bottomNav}>
          {NAV.map(item => {
            const Icon     = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button key={item.id}
                style={{ ...S.bottomNavItem, color: isActive ? "#16a34a" : "#94a3b8" }}
                onClick={() => setActiveTab(item.id)}
                whileTap={{ scale: 0.88 }}>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={22} color={isActive ? "#16a34a" : "#94a3b8"} />
                  {item.badge > 0 && (
                    <span style={{ ...S.bottomNavBadge, backgroundColor: item.badgeClr }}>
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "10px", fontWeight: isActive ? 700 : 500, marginTop: "2px" }}>
                  {item.label.split(" ")[0]}
                </span>
                {isActive && (
                  <motion.div
                    style={S.bottomNavIndicator}
                    layoutId="bottomNavIndicator"
                    transition={{ type: "spring", damping: 24, stiffness: 280 }}
                  />
                )}
              </motion.button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// ── Sidebar content (shared between permanent and overlay) ───────────────────
function SidebarContent({ supData, myLabours, myAssigned, activeTab, setActiveTab, NAV, handleLogout, collapsed = false, onToggle }) {
  return (
    <>
      <div style={{ ...S.sidebarLogo, justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "0 0 18px" : "0 18px 18px" }}>
        {onToggle && (
          <motion.button
            style={S.hamburgerBtn}
            onClick={onToggle}
            whileHover={{ backgroundColor: "#f0fdf4" }}
            whileTap={{ scale: 0.92 }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu size={18} color="#64748b" /> : <Menu size={18} color="#64748b" />}
          </motion.button>
        )}
        {!collapsed && (
          <motion.div
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <div style={S.logoIcon}><Leaf size={18} color="#16a34a" /></div>
            <div>
              <div style={S.logoTitle}>KrishiSetu</div>
              <div style={S.logoSub}>Supervisor Portal</div>
            </div>
          </motion.div>
        )}
        {collapsed && !onToggle && (
          <div style={S.logoIcon}><Leaf size={18} color="#16a34a" /></div>
        )}
      </div>

      {!collapsed && supData && (
        <motion.div style={S.profileCard} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div style={S.profileAvatar}>{supData.name?.[0]?.toUpperCase()}</div>
          <div>
            <div style={S.profileName}>{supData.name}</div>
            <div style={S.profileMeta}>📞 {supData.phone}</div>
            <div style={S.profileMeta}>👥 {myLabours.length} labours</div>
          </div>
        </motion.div>
      )}
      {collapsed && supData && (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 14px" }}>
          <div style={{ ...S.profileAvatar, width: "36px", height: "36px", fontSize: "13px" }}>{supData.name?.[0]?.toUpperCase()}</div>
        </div>
      )}

      <nav style={{ ...S.nav, padding: collapsed ? "14px 8px" : "14px 10px" }}>
        {NAV.map(item => {
          const Icon     = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button key={item.id}
              style={{
                ...S.navItem,
                backgroundColor: isActive ? "#f0fdf4" : "transparent",
                borderLeft: `3px solid ${isActive ? "#16a34a" : "transparent"}`,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "10px 0" : "10px 12px",
                position: "relative",
              }}
              onClick={() => setActiveTab(item.id)} whileHover={{ x: collapsed ? 0 : 3 }} whileTap={{ scale: 0.97 }}
              title={collapsed ? item.label : undefined}>
              <div style={{ position: "relative", display: "inline-flex" }}>
                <Icon size={16} color={isActive ? "#16a34a" : "#94a3b8"} />
                {collapsed && item.badge > 0 && (
                  <span style={{ position: "absolute", top: "-5px", right: "-5px", minWidth: "14px", height: "14px", borderRadius: "7px", backgroundColor: item.badgeClr, color: "#fff", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span style={{ ...S.navLabel, color: isActive ? "#15803d" : "#64748b" }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{ ...S.navBadge, backgroundColor: isActive ? item.badgeClr : "#e2e8f0", color: isActive ? "#fff" : "#64748b" }}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </motion.button>
          );
        })}
      </nav>

      {!collapsed && (
        <motion.div style={S.statsBox} className="stats-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {[
            { label: "Total",     value: myLabours.length,                                    color: "#2563eb" },
            { label: "Available", value: myLabours.filter(l => l.available !== false).length, color: "#16a34a" },
            { label: "Active",    value: myAssigned.length,                                    color: "#d97706" },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div style={S.statsDivider} />}
              <div style={S.statItem}>
                <span style={{ ...S.statNum, color: s.color }}>{s.value}</span>
                <span style={S.statLabel}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </motion.div>
      )}

      <motion.button
        style={{ ...S.logoutBtn, justifyContent: collapsed ? "center" : "flex-start", margin: collapsed ? "0 8px" : "0 12px", padding: collapsed ? "10px 0" : "10px 14px" }}
        onClick={handleLogout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        title={collapsed ? "Logout" : undefined}>
        <LogOut size={14} color="#ef4444" />
        {!collapsed && <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: 600 }}>Logout</span>}
      </motion.button>
    </>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function Pill({ bg, color, border, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: bg, color, border: `1px solid ${border}`, padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      {children}
    </span>
  );
}

function PageHeader({ title, sub, badge }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "10px" }} className="page-header">
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.4px", fontFamily: "'Sora',sans-serif" }}>{title}</h1>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0" }}>{sub}</p>
      </div>
      {badge && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>
          {badge.Icon && <badge.Icon size={13} />}{badge.label}
        </span>
      )}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <motion.div style={{ textAlign: "center", padding: "60px 40px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <div style={{ fontSize: "48px", marginBottom: "12px" }}>{icon}</div>
      <p style={{ fontSize: "17px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px", fontFamily: "'Sora',sans-serif" }}>{title}</p>
      <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>{sub}</p>
    </motion.div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: { minHeight: "100vh", backgroundColor: "#f8fafc", display: "flex", flexDirection: "row", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#1e293b" },

  // Mobile top bar
  topBar:       { position: "fixed", top: 0, left: 0, right: 0, height: "54px", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 200, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  menuBtn:      { background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center" },
  logoIconSm:   { width: "26px", height: "26px", borderRadius: "7px", backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center" },
  topBarTitle:  { fontSize: "15px", fontWeight: 800, color: "#1e293b", fontFamily: "'Sora',sans-serif" },
  topBarAvatar: { width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#dbeafe", border: "2px solid #93c5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#2563eb", fontFamily: "'Sora',sans-serif" },

  // Sidebar backdrop (mobile)
  sidebarBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", zIndex: 300, backdropFilter: "blur(2px)" },
  sidebarOverlay:  { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 400, boxShadow: "4px 0 30px rgba(0,0,0,0.15)" },

  // Modals
  overlay:         { position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px", backdropFilter: "blur(4px)" },
  modal:           { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.12)" },
  modalHeader:     { display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "20px" },
  modalIconWrap:   { width: "36px", height: "36px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalTitle:      { fontSize: "17px", fontWeight: 800, color: "#0f172a", margin: "0 0 2px", fontFamily: "'Sora',sans-serif" },
  modalSub:        { fontSize: "13px", color: "#94a3b8", margin: 0 },
  modalConfirmBtn: { flex: 2, padding: "12px", background: "linear-gradient(135deg,#16a34a,#15803d)", border: "none", borderRadius: "10px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  modalCancelBtn:  { flex: 1, padding: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#ef4444", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  slotPill:        { display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", border: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 600, transition: "all 0.15s" },
  assignInfo:      { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "7px" },
  assignInfoRow:   { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b" },
  sectionLabel:    { fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" },
  labourSelectRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "9px", cursor: "pointer", transition: "all 0.15s" },

  // Sidebar
  sidebar:      { width: "252px", minHeight: "100vh", backgroundColor: "#fff", borderRight: "1px solid #e2e8f0", padding: "22px 0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0, boxShadow: "2px 0 10px rgba(0,0,0,0.04)" },
  sidebarLogo:  { display: "flex", alignItems: "center", gap: "10px", padding: "0 18px 18px", borderBottom: "1px solid #f1f5f9" },
  logoIcon:     { width: "34px", height: "34px", borderRadius: "9px", backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center" },
  logoTitle:    { fontSize: "15px", fontWeight: 800, color: "#1e293b", fontFamily: "'Sora',sans-serif" },
  logoSub:      { fontSize: "10px", color: "#16a34a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
  profileCard:  { margin: "14px 12px", padding: "12px 14px", borderRadius: "12px", border: "1px solid #e0f2fe", backgroundColor: "#f0f9ff", display: "flex", alignItems: "center", gap: "10px" },
  profileAvatar:{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#dbeafe", border: "2px solid #93c5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 800, color: "#2563eb", flexShrink: 0, fontFamily: "'Sora',sans-serif" },
  profileName:  { fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "2px" },
  profileMeta:  { fontSize: "11px", color: "#64748b" },
  nav:          { padding: "14px 10px", flex: 1 },
  navItem:      { width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderRadius: "9px", border: "none", cursor: "pointer", marginBottom: "3px", transition: "all 0.18s" },
  navLabel:     { fontSize: "13px", fontWeight: 600, flex: 1, textAlign: "left" },
  navBadge:     { fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", transition: "all 0.18s" },
  statsBox:     { margin: "0 12px 14px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-around" },
  statsDivider: { width: "1px", backgroundColor: "#e2e8f0" },
  statItem:     { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
  statNum:      { fontSize: "18px", fontWeight: 800, lineHeight: 1, fontFamily: "'Sora',sans-serif" },
  statLabel:    { fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px" },
  logoutBtn:    { margin: "0 12px", padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  hamburgerBtn: { width: "34px", height: "34px", borderRadius: "9px", backgroundColor: "transparent", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" },

  // Main — base styles; CSS classes handle responsive overrides
  main: { flex: 1, padding: "28px 32px", overflowY: "auto", minHeight: "100vh" },
  list: { display: "flex", flexDirection: "column", gap: "14px" },

  // Cards
  card:    { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "18px", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" },
  cost:    { fontSize: "17px", fontWeight: 800, color: "#0f172a", fontFamily: "'Sora',sans-serif" },
  grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "12px" },
  detail:  { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b" },
  availChip: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", marginBottom: "10px" },
  actionBtn: { width: "100%", padding: "11px", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontFamily: "inherit", transition: "all 0.15s" },

  completionBanner: { display: "flex", alignItems: "center", gap: "7px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 12px", marginBottom: "14px", fontSize: "12px", fontWeight: 700, color: "#15803d" },

  // Labour boxes
  laboursBox:     { backgroundColor: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "10px", padding: "12px", marginBottom: "10px" },
  laboursBoxHead: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" },
  labourRow:      { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "8px", flexWrap: "wrap", gap: "4px" },
  farmerTag:      { fontSize: "10px", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "6px", fontWeight: 600 },

  confirmBtn:   { width: "100%", padding: "11px", backgroundColor: "#f0fdf4", border: "1.5px solid #16a34a", borderRadius: "10px", color: "#15803d", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontFamily: "inherit", marginTop: "4px" },
  confirmedRow: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", marginTop: "4px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "12px", color: "#16a34a", fontWeight: 600, flexWrap: "wrap" },

  // Labour management
  labourCard:   { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.2s", flexWrap: "wrap" },
  labourAvatar: { width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#dbeafe", border: "2px solid #93c5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800, color: "#2563eb", flexShrink: 0, fontFamily: "'Sora',sans-serif" },
  unavailTag:   { display: "inline-flex", alignItems: "center", gap: "2px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", color: "#ef4444" },
  unavailBtn:   { display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  deleteBtn:    { padding: "7px 10px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", fontFamily: "inherit" },

  // Form
  label:  { display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" },
  input:  { width: "100%", padding: "10px 13px", backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "9px", fontSize: "13px", color: "#1e293b", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  addBtn: { padding: "10px 18px", background: "linear-gradient(135deg,#3b82f6,#2563eb)", border: "none", borderRadius: "9px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontFamily: "inherit", whiteSpace: "nowrap" },

  // Mobile bottom navigation
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "66px", backgroundColor: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "stretch", zIndex: 200, boxShadow: "0 -2px 12px rgba(0,0,0,0.07)" },
  bottomNavItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", padding: "6px 4px", position: "relative" },
  bottomNavBadge: { position: "absolute", top: "-3px", right: "-3px", minWidth: "16px", height: "16px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff", padding: "0 3px" },
  bottomNavIndicator: { position: "absolute", top: 0, left: "20%", right: "20%", height: "3px", backgroundColor: "#16a34a", borderRadius: "0 0 3px 3px" },
};