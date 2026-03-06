import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection, query, where, doc, getDoc,
  onSnapshot, updateDoc, addDoc, deleteDoc,
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Leaf, LogOut, Users, ClipboardList, CheckSquare,
  Plus, Trash2, Phone, Calendar, Clock, MapPin,
  FileText, Sun, Sunset, Sunrise, User,
  CheckCircle2, XCircle, ToggleLeft, ToggleRight,
  Navigation, Menu, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const SLOT_CONFIG = {
  "8-12":  { label: "Morning",   time: "8AM–12PM", icon: Sunrise, color: "#b45309", bg: "#fef9f0", border: "#fde68a", rate: 300 },
  "2-6":   { label: "Afternoon", time: "2PM–6PM",  icon: Sunset,  color: "#c2410c", bg: "#fff7f0", border: "#fed7aa", rate: 300 },
  fullday: { label: "Full Day",  time: "8AM–6PM",  icon: Sun,     color: "#2d6a4f", bg: "#f0fdf4", border: "#bbf7d0", rate: 600 },
};

function getDistanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function SupervisorDashboard() {
  const [supData,         setSupData]         = useState(null);
  const [myLabours,       setMyLabours]       = useState([]);
  const [allBookings,     setAllBookings]     = useState([]);
  const [activeTab,       setActiveTab]       = useState("requests");
  const [assignSubTab,    setAssignSubTab]    = useState("live");
  const [loading,         setLoading]         = useState(false);
  const [authChecked,     setAuthChecked]     = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [watchId,         setWatchId]         = useState(null);

  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [assignModal,       setAssignModal]       = useState(null);
  const [selectedLabourIds, setSelectedLabourIds] = useState([]);

  const [unavailModal,  setUnavailModal]  = useState(null);
  const [unavailDate,   setUnavailDate]   = useState("");
  const [unavailSlot,   setUnavailSlot]   = useState("8-12");
  const [unavailReason, setUnavailReason] = useState("");

  const navigate = useNavigate();

  // ── AUTH PERSISTENCE ─────────────────────────────────────
  useEffect(() => {
    let unsubLabours, unsubBookings;
    const unsubAuth = onAuthStateChanged(auth, user => {
      setAuthChecked(true);
      if (!user) { navigate("/login"); return; }
      getDoc(doc(db, "users", user.uid)).then(d => {
        if (d.exists()) setSupData({ id: user.uid, ...d.data() });
      });
      const lq = query(collection(db, "labours"), where("supervisorId", "==", user.uid));
      unsubLabours  = onSnapshot(lq, snap => setMyLabours(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubBookings = onSnapshot(collection(db, "bookings"), snap => setAllBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    });
    return () => { unsubAuth(); unsubLabours?.(); unsubBookings?.(); };
  }, [navigate]);

  useEffect(() => {
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [watchId]);

  if (!authChecked) return null;

  // ── DERIVED DATA ─────────────────────────────────────────
  const isLabourAvailableForSlot = (labour, date, slot) => {
    if (labour.unavailability?.[`${date}_${slot}`]) return false;
    if (slot === "fullday") {
      if (labour.unavailability?.[`${date}_8-12`]) return false;
      if (labour.unavailability?.[`${date}_2-6`])  return false;
    }
    return !allBookings.some(b => {
      if (b.status !== "assigned" && b.status !== "completed") return false;
      if (b.date !== date || !b.assignedLabourIds?.includes(labour.id)) return false;
      return b.timeSlot === slot || b.timeSlot === "fullday" || slot === "fullday";
    });
  };

  const getAvailableForSlot = (date, slot) =>
    (!date || !slot) ? myLabours.length
    : myLabours.filter(l => isLabourAvailableForSlot(l, date, slot)).length;

  const pendingBookings  = allBookings.filter(b => b.status === "pending");
  const myAllAssignments = allBookings.filter(
    b => b.supervisorId === auth.currentUser?.uid &&
         (b.status === "assigned" || b.status === "completed")
  );
  const myAssigned = myAllAssignments.filter(b => b.status === "assigned");

  // ── Assignment sub-tab buckets ──
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const upcomingAssignments = myAllAssignments.filter(b => {
    const d = new Date(b.date); d.setHours(0, 0, 0, 0);
    return d > today && b.status === "assigned";
  });
  const liveAssignments = myAllAssignments.filter(b => {
    const d = new Date(b.date); d.setHours(0, 0, 0, 0);
    return d <= today && b.status === "assigned";
  });
  const completedAssignments = myAllAssignments.filter(b => b.status === "completed");

  // Most-recent date first
  const sortDesc = arr => [...arr].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ── HANDLERS ─────────────────────────────────────────────

  const handleAddLabour = async e => {
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
      toast.success(`${newName} added to your team`);
      setNewName(""); setNewPhone("");
    } catch { toast.error("Failed to add labour."); }
    setLoading(false);
  };

  const handleDeleteLabour = async (labourId, name) => {
    if (!window.confirm(`Remove ${name} from your team?`)) return;
    try { await deleteDoc(doc(db, "labours", labourId)); toast.success(`${name} removed.`); }
    catch { toast.error("Failed to remove."); }
  };

  const handleMarkUnavailable = async () => {
    if (!unavailDate) { toast.error("Select a date!"); return; }
    try {
      const key     = `${unavailDate}_${unavailSlot}`;
      const updated = { ...(unavailModal.unavailability || {}), [key]: unavailReason || "Personal reason" };
      await updateDoc(doc(db, "labours", unavailModal.id), { unavailability: updated });
      toast.success("Marked unavailable");
      setUnavailModal(null); setUnavailDate(""); setUnavailReason("");
    } catch { toast.error("Failed to update."); }
  };

  const handleRemoveUnavailability = async (labourId, key) => {
    const labour  = myLabours.find(l => l.id === labourId);
    const updated = { ...(labour.unavailability || {}) };
    delete updated[key];
    await updateDoc(doc(db, "labours", labourId), { unavailability: updated });
    toast.success("Availability restored");
  };

  const handleAssign = async () => {
    if (!assignModal) return;
    if (selectedLabourIds.length === 0)                     { toast.error("Select at least 1 labour!"); return; }
    if (selectedLabourIds.length > assignModal.labourCount) { toast.error(`Farmer needs only ${assignModal.labourCount} labours!`); return; }
    setLoading(true);
    try {
      const selected = myLabours.filter(l => selectedLabourIds.includes(l.id));
      await updateDoc(doc(db, "bookings", assignModal.id), {
        status:              "assigned",
        supervisorId:        supData.id,
        supervisorName:      supData.name,
        supervisorPhone:     supData.phone,
        assignedLabour:      selectedLabourIds.length,
        assignedLabourIds:   selectedLabourIds,
        assignedLabourNames: selected.map(l => l.name),
      });
      toast.success(`Assigned to ${assignModal.farmerName}`);
      setAssignModal(null); setSelectedLabourIds([]);
    } catch { toast.error("Failed to assign."); }
    setLoading(false);
  };

  // Supervisor marks individual labour present/absent — writes labourAttendance on booking doc
  // Admin panel reads this same field so it reflects immediately
  const handleMarkLabourAttendance = async (bookingId, labourId, currentStatus) => {
    try {
      const booking = allBookings.find(b => b.id === bookingId);
      const updated = { ...(booking.labourAttendance || {}), [labourId]: !currentStatus };
      await updateDoc(doc(db, "bookings", bookingId), { labourAttendance: updated });
      toast.success(!currentStatus ? "Marked as present" : "Marked as absent");
    } catch { toast.error("Failed to update attendance."); }
  };

  // When supervisor confirms — also sets status:"completed" if farmer already confirmed,
  // which moves the card out of Live/Upcoming into the Completed sub-tab
  const handleConfirmAttendance = async bookingId => {
    const booking     = allBookings.find(b => b.id === bookingId);
    const goCompleted = booking?.farmerConfirmed === true;

    const buildPayload = extra => ({
      supervisorConfirmed: true,
      ...(goCompleted ? { status: "completed" } : {}),
      ...extra,
    });

    if (booking?.farmLat && booking?.farmLng) {
      try {
        await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            async pos => {
              const distance = getDistanceMetres(pos.coords.latitude, pos.coords.longitude, booking.farmLat, booking.farmLng);
              const visited  = distance <= 500;
              await updateDoc(doc(db, "bookings", bookingId), buildPayload({
                supervisorVisitedFarm: visited, supervisorVisitedAt: new Date(), supervisorVisitDistance: Math.round(distance),
              }));
              toast.success(visited ? "Work confirmed — farm visit verified" : "Work confirmed");
              resolve();
            },
            async () => {
              await updateDoc(doc(db, "bookings", bookingId), buildPayload({ supervisorVisitedFarm: false, supervisorVisitedAt: new Date() }));
              toast.success("Work confirmed");
              resolve();
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      } catch { toast.error("Failed to confirm."); }
    } else {
      try {
        await updateDoc(doc(db, "bookings", bookingId), buildPayload({}));
        toast.success("Work confirmed");
      } catch { toast.error("Failed to confirm."); }
    }
  };

  const handleToggleLocationSharing = async () => {
    if (!supData) return;
    if (!locationSharing) {
      if (!navigator.geolocation) { toast.error("Geolocation not supported."); return; }
      const id = navigator.geolocation.watchPosition(
        async pos => {
          try {
            await updateDoc(doc(db, "users", supData.id), {
              supervisorLat: pos.coords.latitude, supervisorLng: pos.coords.longitude,
              supervisorLocationUpdatedAt: new Date(),
            });
          } catch {}
        },
        () => toast.error("Location access denied."),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
      setWatchId(id); setLocationSharing(true);
      toast.success("Live location sharing enabled");
    } else {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setWatchId(null); setLocationSharing(false);
      try { await updateDoc(doc(db, "users", supData.id), { supervisorLat: null, supervisorLng: null, supervisorLocationUpdatedAt: null }); }
      catch {}
      toast.success("Location sharing disabled");
    }
  };

  const handleLogout = async () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (supData) {
      try { await updateDoc(doc(db, "users", supData.id), { supervisorLat: null, supervisorLng: null, supervisorLocationUpdatedAt: null }); }
      catch {}
    }
    await signOut(auth);
    navigate("/login");
  };

  const toggleLabour = id =>
    setSelectedLabourIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  // ── ASSIGNMENT CARD (shared by all 3 sub-tabs) ───────────
  const AssignmentCard = ({ booking }) => {
    const slotCfg      = SLOT_CONFIG[booking.timeSlot];
    const SlotIcon     = slotCfg?.icon || Clock;
    const labourAtt    = booking.labourAttendance || {};
    const presentCount = Object.values(labourAtt).filter(Boolean).length;
    const absentCount  = (booking.assignedLabour || 0) - presentCount;
    const isCompleted  = booking.status === "completed";

    return (
      <motion.div style={s.bookingCard}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2, boxShadow: "0 10px 28px rgba(27,67,50,0.10)" }}>

        {/* Top bar */}
        <div style={s.bTopBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={s.dateBadge}><Calendar size={11} color="#2d6a4f" strokeWidth={2.5} />{booking.date}</div>
            <div style={{ ...s.slotBadge, background: slotCfg?.bg, color: slotCfg?.color, borderColor: slotCfg?.border }}>
              <SlotIcon size={11} strokeWidth={2} />{slotCfg?.label}
            </div>
            {isCompleted
              ? <div style={{ ...s.slotBadge, background: "#f5f3ff", color: "#3730a3", borderColor: "#c4b5fd" }}><CheckCircle2 size={11} strokeWidth={2} />Completed</div>
              : <div style={{ ...s.slotBadge, background: "#f0fdf4", color: "#14532d", borderColor: "#bbf7d0" }}><CheckCircle2 size={11} strokeWidth={2} />Assigned</div>
            }
          </div>
          <span style={s.costTag}>₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}</span>
        </div>

        <div style={s.bDivider} />

        <div className="sd-grid2" style={s.bDetailsGrid}>
          <div style={s.bDetail}><User   size={13} color="#9ca3af" strokeWidth={2} />{booking.farmerName}</div>
          <div style={s.bDetail}><Phone  size={13} color="#9ca3af" strokeWidth={2} />{booking.farmerPhone}</div>
          <div style={s.bDetail}><Users  size={13} color="#9ca3af" strokeWidth={2} />{booking.assignedLabour} assigned</div>
          <div style={{ ...s.bDetail, gridColumn: "span 2", overflow: "hidden" }}>
            <MapPin size={13} color="#9ca3af" strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.farmAddress || booking.village}</span>
          </div>
          {booking.workType && <div style={s.bDetail}><FileText size={13} color="#9ca3af" strokeWidth={2} />{booking.workType}</div>}
        </div>

        {booking.farmLat && booking.farmLng && (
          <div style={s.mapsChip}>
            <Navigation size={12} color="#2d6a4f" strokeWidth={2} />
            <a href={mapsLink(booking.farmLat, booking.farmLng)} target="_blank" rel="noreferrer"
              style={{ color: "#2d6a4f", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View farm location on Maps</a>
          </div>
        )}

        {/* ── ATTENDANCE ─────────────────────────────────── */}
        {booking.assignedLabourNames?.length > 0 && (
          <div style={s.attendanceBlock}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={12} color="#774936" strokeWidth={2.5} />
                <span style={{ color: "#774936", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Attendance ({booking.assignedLabour})
                </span>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <span style={{ color: "#16a34a", fontSize: 11, fontWeight: 600 }}>{presentCount} present</span>
                <span style={{ color: absentCount > 0 ? "#dc2626" : "#9ca3af", fontSize: 11, fontWeight: 600 }}>{absentCount} absent</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {booking.assignedLabourNames.map((name, idx) => {
                const labourId        = booking.assignedLabourIds?.[idx];
                const isPresent       = labourAtt[labourId] === true;
                const farmerConfirmed = booking.farmerAttendance?.[labourId] === true;

                return (
                  <div key={idx} style={{ ...s.labourAttRow, background: isPresent ? "#f4fdf6" : "#fafcfb", borderColor: isPresent ? "#b7e4c7" : "#e4ede8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: isPresent ? "#16a34a" : "#d1d5db", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: isPresent ? "#14532d" : "#6b7280", fontWeight: isPresent ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </span>
                      {farmerConfirmed && <span style={s.farmerConfirmedTag}>farmer confirmed</span>}
                    </div>

                    {/* Toggle button — disabled once booking is completed */}
                    {!isCompleted ? (
                      <motion.button
                        style={{
                          padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${isPresent ? "#86efac" : "#e4ede8"}`,
                          background: isPresent ? "#dcfce7" : "#f3f4f6",
                          color: isPresent ? "#15803d" : "#6b7280",
                          fontFamily: "'Poppins','Segoe UI',sans-serif", flexShrink: 0, marginLeft: 8,
                        }}
                        onClick={() => handleMarkLabourAttendance(booking.id, labourId, isPresent)}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.92 }}>
                        {isPresent ? "Present ✓" : "Mark Present"}
                      </motion.button>
                    ) : (
                      <span style={{ fontSize: 11, color: isPresent ? "#16a34a" : "#9ca3af", fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                        {isPresent ? "Present" : "Absent"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONFIRM WORK COMPLETED ────────────────────── */}
        {!booking.supervisorConfirmed ? (
          <motion.button style={s.confirmBtn}
            onClick={() => handleConfirmAttendance(booking.id)}
            whileHover={{ background: "#dcfce7" }} whileTap={{ scale: 0.97 }}>
            <CheckCircle2 size={14} strokeWidth={2.5} /> Confirm Work Completed
          </motion.button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <div style={s.confirmedBar}>
              <CheckCircle2 size={13} color="#16a34a" strokeWidth={2.5} />
              <span>You confirmed attendance</span>
              {!booking.farmerConfirmed
                ? <span style={{ color: "#92400e", fontSize: 11, marginLeft: 4 }}>· Awaiting farmer</span>
                : <span style={{ color: "#16a34a",  fontSize: 11, marginLeft: 4 }}>· Farmer also confirmed</span>}
            </div>
            {booking.supervisorVisitedFarm === true && (
              <div style={{ ...s.confirmedBar, borderColor: "#b7e4c7" }}>
                <Navigation size={12} color="#2d6a4f" strokeWidth={2} />
                <span style={{ fontSize: 11 }}>Farm visit verified{booking.supervisorVisitDistance != null ? ` · ${booking.supervisorVisitDistance}m` : ""}</span>
              </div>
            )}
            {booking.supervisorVisitedFarm === false && booking.supervisorVisitedAt && (
              <div style={{ ...s.confirmedBar, background: "#fffbeb", borderColor: "#fde68a" }}>
                <Navigation size={12} color="#b45309" strokeWidth={2} />
                <span style={{ color: "#92400e", fontSize: 11 }}>
                  Location not near farm at confirmation{booking.supervisorVisitDistance != null ? ` · ${booking.supervisorVisitDistance}m` : ""}
                </span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  // ── SIDEBAR ──────────────────────────────────────────────
  const SidebarContent = ({ onNavigate }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: 20 }}>
      <div style={s.brand}>
        <div style={s.brandMark}><Leaf size={16} color="#fff" strokeWidth={2.5} /></div>
        <div>
          <div style={s.brandName}>KrishiSetu</div>
          <div style={s.brandSub}>Supervisor Portal</div>
        </div>
      </div>

      {supData && (
        <div style={s.profileCard}>
          <div style={s.profileAvatar}>{supData.name?.[0]?.toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={s.profileName}>{supData.name}</div>
            <div style={s.profileMeta}><Phone size={9} color="#8aab97" strokeWidth={2} />{supData.phone}</div>
            <div style={s.profileMeta}><Users size={9} color="#8aab97" strokeWidth={2} />{myLabours.length} labours in team</div>
          </div>
        </div>
      )}

      <div style={{ ...s.locationToggle, borderColor: locationSharing ? "#b7e4c7" : "#e4ede8", background: locationSharing ? "#f4fdf6" : "#fafcfb" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Navigation size={13} color={locationSharing ? "#2d6a4f" : "#9ca3af"} strokeWidth={2} />
            <span style={{ fontSize: 12, fontWeight: 700, color: locationSharing ? "#1b4332" : "#9ca3af" }}>Live Location</span>
          </div>
          <motion.button onClick={handleToggleLocationSharing}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
            whileTap={{ scale: 0.88 }}>
            {locationSharing ? <ToggleRight size={26} color="#2d6a4f" /> : <ToggleLeft size={26} color="#c0d5c8" />}
          </motion.button>
        </div>
        <p style={{ fontSize: 10, color: locationSharing ? "#5c7a6b" : "#a0bcaf", marginTop: 5, lineHeight: 1.5 }}>
          {locationSharing ? "Sharing your location with admin in real-time" : "Enable so admin can track your location"}
        </p>
      </div>

      <div style={s.navSectionLabel}>Navigation</div>
      <nav style={{ padding: "0 10px", flex: 1 }}>
        {[
          { id: "requests", icon: ClipboardList, label: "Farm Requests",  badge: pendingBookings.length },
          { id: "assigned", icon: CheckSquare,   label: "My Assignments", badge: myAssigned.length },
          { id: "labours",  icon: Users,         label: "My Labours",     badge: myLabours.length },
        ].map(item => {
          const Icon = item.icon; const isActive = activeTab === item.id;
          return (
            <motion.button key={item.id}
              style={{ ...s.navBtn, background: isActive ? "#f0f7f3" : "transparent", borderLeftColor: isActive ? "#774936" : "transparent" }}
              onClick={() => { setActiveTab(item.id); onNavigate?.(); }}
              whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}>
              <Icon size={16} color={isActive ? "#774936" : "#a0bcaf"} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ ...s.navBtnLabel, color: isActive ? "#774936" : "#6b7280" }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ ...s.navBadge, background: isActive ? "#774936" : "#e8f5e9", color: isActive ? "#fff" : "#6b7280" }}>{item.badge}</span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div style={s.statsRow}>
        {[
          { val: myLabours.length,                                    label: "Total" },
          { val: myLabours.filter(l => l.available !== false).length, label: "Available" },
          { val: myAssigned.length,                                   label: "Assigned" },
        ].map((st, i) => (
          <div key={st.label} style={{ textAlign: "center", flex: 1, borderRight: i < 2 ? "1px solid #e4ede8" : "none" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1b4332", lineHeight: 1 }}>{st.val}</div>
            <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 3 }}>{st.label}</div>
          </div>
        ))}
      </div>

      <motion.button style={s.logoutBtn} onClick={handleLogout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
        <LogOut size={15} color="#dc2626" strokeWidth={2} />
        <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>Sign Out</span>
      </motion.button>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7faf8; }
        .sd-root      { min-height:100vh; display:flex; background:#f7faf8; font-family:'Poppins','Segoe UI',sans-serif; color:#1a1a1a; }
        .sd-sidebar   { width:252px; min-height:100vh; background:#fff; border-right:1px solid #e4ede8; display:flex; flex-direction:column; position:sticky; top:0; height:100vh; overflow-y:auto; flex-shrink:0; box-shadow:1px 0 12px rgba(27,67,50,0.05); }
        .sd-main-wrap { flex:1; display:flex; flex-direction:column; min-width:0; }
        .sd-topbar    { display:none; }
        .sd-main      { flex:1; padding:32px 36px; overflow-y:auto; }
        .sd-overlay   { display:none; }
        .sd-drawer    { display:none; }
        @media(max-width:960px){
          .sd-sidebar  { display:none; }
          .sd-topbar   { display:flex; position:sticky; top:0; z-index:30; background:#fff; border-bottom:1px solid #e4ede8; padding:12px 18px; align-items:center; justify-content:space-between; box-shadow:0 1px 10px rgba(27,67,50,0.07); }
          .sd-main     { padding:18px; }
          .sd-overlay  { display:block; position:fixed; inset:0; background:rgba(0,0,0,0.22); z-index:40; backdrop-filter:blur(2px); }
          .sd-drawer   { display:flex; flex-direction:column; position:fixed; left:0; top:0; height:100vh; width:260px; background:#fff; z-index:50; overflow-y:auto; box-shadow:4px 0 32px rgba(27,67,50,0.14); }
        }
        @media(max-width:720px){ .sd-grid2 { grid-template-columns:1fr !important; } }
        input:focus, textarea:focus, select:focus { outline:none !important; border-color:#774936 !important; box-shadow:0 0 0 3px rgba(119,73,54,0.10) !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#d8f3dc; border-radius:10px; }
      `}</style>

      <div className="sd-root">
        <Toaster position="top-center" toastOptions={{
          style: { fontFamily: "'Poppins','Segoe UI',sans-serif", fontSize: "13px", borderRadius: "10px", border: "1px solid #e4ede8", boxShadow: "0 4px 20px rgba(27,67,50,0.10)" },
        }} />

        {/* ── UNAVAILABILITY MODAL ── */}
        <AnimatePresence>
          {unavailModal && (
            <motion.div style={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div style={s.modal} initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}>
                <h3 style={s.modalTitle}>Mark Unavailable</h3>
                <p style={s.modalSub}>{unavailModal.name}</p>
                <label style={s.fieldLabel}>Date</label>
                <input style={s.modalInput} type="date" value={unavailDate}
                  onChange={e => setUnavailDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} />
                <label style={s.fieldLabel}>Time Slot</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <motion.button key={key} type="button"
                        style={{ ...s.slotPill, background: unavailSlot === key ? cfg.bg : "#fafcfb", borderColor: unavailSlot === key ? cfg.border : "#e4ede8", color: unavailSlot === key ? cfg.color : "#9ca3af" }}
                        onClick={() => setUnavailSlot(key)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        <Icon size={12} strokeWidth={2} />{cfg.label}
                      </motion.button>
                    );
                  })}
                </div>
                <label style={s.fieldLabel}>Reason (optional)</label>
                <input style={s.modalInput} type="text" placeholder="Personal reason, illness…"
                  value={unavailReason} onChange={e => setUnavailReason(e.target.value)} />
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <motion.button style={s.modalPrimaryBtn} onClick={handleMarkUnavailable} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Confirm</motion.button>
                  <motion.button style={s.modalCancelBtn}  onClick={() => setUnavailModal(null)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Cancel</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ASSIGN MODAL ── */}
        <AnimatePresence>
          {assignModal && (
            <motion.div style={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div style={{ ...s.modal, maxWidth: 460 }} initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}>
                <h3 style={s.modalTitle}>Assign Labour</h3>
                <p style={s.modalSub}>Select labourers for this booking</p>
                <div style={s.assignSummary}>
                  {[
                    { Icon: Calendar,                                        color: "#2d6a4f", val: assignModal.date },
                    { Icon: SLOT_CONFIG[assignModal.timeSlot]?.icon || Clock, color: SLOT_CONFIG[assignModal.timeSlot]?.color, val: `${SLOT_CONFIG[assignModal.timeSlot]?.label} · ${SLOT_CONFIG[assignModal.timeSlot]?.time}` },
                    { Icon: User,    color: "#774936", val: `${assignModal.farmerName} · ${assignModal.labourCount} labours needed` },
                    { Icon: MapPin,  color: "#9ca3af", val: assignModal.farmAddress || assignModal.village },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5c7a6b" }}>
                      <row.Icon size={13} color={row.color} strokeWidth={2} /><span>{row.val}</span>
                    </div>
                  ))}
                  {assignModal.farmLat && assignModal.farmLng && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Navigation size={13} color="#2d6a4f" strokeWidth={2} />
                      <a href={mapsLink(assignModal.farmLat, assignModal.farmLng)} target="_blank" rel="noreferrer"
                        style={{ color: "#2d6a4f", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View farm on Maps</a>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#8aab97", marginBottom: 10 }}>
                  Selected: <span style={{ color: "#774936", fontWeight: 700 }}>{selectedLabourIds.length}</span> / {assignModal.labourCount} needed
                </p>
                <p style={s.sectionLabel}>Available for this slot</p>
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {myLabours.filter(l => isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).length === 0 ? (
                    <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No available labours for this slot</p>
                  ) : myLabours.filter(l => isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).map(l => {
                    const isSel = selectedLabourIds.includes(l.id);
                    return (
                      <motion.div key={l.id}
                        style={{ ...s.labourSelectRow, background: isSel ? "#fdf6f3" : "#fafcfb", borderColor: isSel ? "#f4c0a0" : "#e4ede8" }}
                        onClick={() => toggleLabour(l.id)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ ...s.labourSelectAvatar, background: isSel ? "#fde8d8" : "#f0f4f2", color: isSel ? "#774936" : "#9ca3af", border: `1.5px solid ${isSel ? "#f4c0a0" : "#e4ede8"}` }}>{l.name[0]}</div>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isSel ? "#774936" : "#374151" }}>{l.name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{l.phone}</p>
                          </div>
                        </div>
                        {isSel && <CheckCircle2 size={16} color="#774936" strokeWidth={2.5} />}
                      </motion.div>
                    );
                  })}
                </div>
                {myLabours.filter(l => !isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).length > 0 && (
                  <>
                    <p style={{ ...s.sectionLabel, color: "#dc2626" }}>Busy / Unavailable</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12, opacity: 0.5 }}>
                      {myLabours.filter(l => !isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).map(l => (
                        <div key={l.id} style={{ ...s.labourSelectRow, cursor: "default", background: "#fafcfb" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ ...s.labourSelectAvatar, background: "#f0f4f2", color: "#9ca3af" }}>{l.name[0]}</div>
                            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{l.name}</p>
                          </div>
                          <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>Unavailable</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <motion.button style={{ ...s.modalPrimaryBtn, opacity: selectedLabourIds.length === 0 ? 0.45 : 1 }}
                    onClick={handleAssign} disabled={loading || selectedLabourIds.length === 0}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    {loading ? "Assigning…" : `Assign ${selectedLabourIds.length} Labour${selectedLabourIds.length !== 1 ? "s" : ""}`}
                  </motion.button>
                  <motion.button style={s.modalCancelBtn}
                    onClick={() => { setAssignModal(null); setSelectedLabourIds([]); }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Cancel</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <aside className="sd-sidebar"><SidebarContent /></aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div className="sd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
              <motion.div className="sd-drawer" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: "tween", duration: 0.2 }}>
                <button onClick={() => setSidebarOpen(false)}
                  style={{ position: "absolute", top: 14, right: 14, background: "#f4fdf6", border: "1px solid #e4ede8", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af", zIndex: 1, display: "flex" }}>
                  <X size={16} />
                </button>
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="sd-main-wrap">
          {/* Mobile topbar */}
          <div className="sd-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={s.brandMark}><Leaf size={15} color="#fff" strokeWidth={2.5} /></div>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#774936", letterSpacing: "-0.3px" }}>KrishiSetu</span>
            </div>
            <button onClick={() => setSidebarOpen(true)}
              style={{ background: "#fdf6f3", border: "1px solid #f4c0a0", cursor: "pointer", padding: "7px 8px", borderRadius: 8, color: "#774936", display: "flex" }}>
              <Menu size={20} />
            </button>
          </div>

          <main className="sd-main">
            <AnimatePresence mode="wait">

              {/* ═══════ FARM REQUESTS ═══════ */}
              {activeTab === "requests" && (
                <motion.div key="requests" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.25 }}>
                  <div style={s.pageHeader}>
                    <div>
                      <h1 style={{ ...s.pageTitle, color: "#774936" }}>Farm Requests</h1>
                      <p style={s.pageSub}>{pendingBookings.length} pending request{pendingBookings.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {pendingBookings.length === 0 ? (
                    <div style={s.emptyState}>
                      <ClipboardList size={36} color="#d0ddd8" strokeWidth={1.5} />
                      <p style={s.emptyTitle}>No pending requests</p>
                      <p style={s.emptySub}>New farm booking requests will appear here</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {sortDesc(pendingBookings).map(booking => {
                        const slotCfg      = SLOT_CONFIG[booking.timeSlot];
                        const SlotIcon     = slotCfg?.icon || Clock;
                        const availForSlot = getAvailableForSlot(booking.date, booking.timeSlot);
                        const canAssign    = availForSlot >= booking.labourCount;

                        return (
                          <motion.div key={booking.id} style={s.bookingCard}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -2, boxShadow: "0 10px 28px rgba(27,67,50,0.10)" }}>

                            <div style={s.bTopBar}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <div style={s.dateBadge}><Calendar size={11} color="#2d6a4f" strokeWidth={2.5} />{booking.date}</div>
                                <div style={{ ...s.slotBadge, background: slotCfg?.bg, color: slotCfg?.color, borderColor: slotCfg?.border }}>
                                  <SlotIcon size={11} strokeWidth={2} />{slotCfg?.label}
                                </div>
                              </div>
                              <span style={s.costTag}>₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}</span>
                            </div>

                            <div style={s.bDivider} />

                            <div className="sd-grid2" style={s.bDetailsGrid}>
                              <div style={s.bDetail}><User     size={13} color="#9ca3af" strokeWidth={2} />{booking.farmerName}</div>
                              <div style={s.bDetail}><Phone    size={13} color="#9ca3af" strokeWidth={2} />{booking.farmerPhone}</div>
                              <div style={s.bDetail}><Users    size={13} color="#9ca3af" strokeWidth={2} />{booking.labourCount} labours needed</div>
                              <div style={s.bDetail}><SlotIcon size={13} color={slotCfg?.color} strokeWidth={2} />{slotCfg?.time}</div>
                              <div style={{ ...s.bDetail, gridColumn: "span 2", overflow: "hidden" }}>
                                <MapPin size={13} color="#9ca3af" strokeWidth={2} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.farmAddress || booking.village}</span>
                              </div>
                              {booking.workType && <div style={s.bDetail}><FileText size={13} color="#9ca3af" strokeWidth={2} />{booking.workType}</div>}
                            </div>

                            {booking.farmLat && booking.farmLng && (
                              <div style={s.mapsChip}>
                                <Navigation size={12} color="#2d6a4f" strokeWidth={2} />
                                <a href={mapsLink(booking.farmLat, booking.farmLng)} target="_blank" rel="noreferrer"
                                  style={{ color: "#2d6a4f", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View farm location on Maps</a>
                              </div>
                            )}

                            <div style={{ ...s.availChip, background: canAssign ? "#f4fdf6" : "#fff8f8", borderColor: canAssign ? "#b7e4c7" : "#fca5a5" }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: canAssign ? "#2d6a4f" : "#dc2626", flexShrink: 0 }} />
                              <span style={{ color: canAssign ? "#2d6a4f" : "#dc2626", fontSize: 12, fontWeight: 600 }}>
                                {availForSlot} of your labours available for this slot
                              </span>
                            </div>

                            <motion.button
                              style={{ ...s.assignBtn, opacity: canAssign ? 1 : 0.45, cursor: canAssign ? "pointer" : "not-allowed" }}
                              onClick={() => {
                                if (!canAssign) { toast.error(`Not enough labours — only ${availForSlot} available`); return; }
                                setAssignModal(booking); setSelectedLabourIds([]);
                              }}
                              whileHover={{ scale: canAssign ? 1.01 : 1 }} whileTap={{ scale: canAssign ? 0.98 : 1 }}>
                              <Users size={14} strokeWidth={2.5} />
                              {canAssign ? "Select & Assign Labours" : `Need ${booking.labourCount}, only ${availForSlot} available`}
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ═══════ MY ASSIGNMENTS — Upcoming / Live / Completed ═══════ */}
              {activeTab === "assigned" && (
                <motion.div key="assigned" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.25 }}>
                  <div style={s.pageHeader}>
                    <div>
                      <h1 style={{ ...s.pageTitle, color: "#774936" }}>My Assignments</h1>
                      <p style={s.pageSub}>{myAllAssignments.length} total assignment{myAllAssignments.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* ── Sub-tabs ── */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
                    {[
                      { id: "upcoming",  label: "Upcoming",  count: upcomingAssignments.length,  activeBg: "#fef9f0", activeBorder: "#fde68a", activeColor: "#92400e", dot: "#b45309" },
                      { id: "live",      label: "Live Now",  count: liveAssignments.length,       activeBg: "#f0fdf4", activeBorder: "#52b788", activeColor: "#1b4332", dot: "#2d6a4f" },
                      { id: "completed", label: "Completed", count: completedAssignments.length,  activeBg: "#f5f3ff", activeBorder: "#c4b5fd", activeColor: "#3730a3", dot: "#6366f1" },
                    ].map(tab => {
                      const isActive = assignSubTab === tab.id;
                      return (
                        <motion.button key={tab.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 24,
                            cursor: "pointer", fontFamily: "'Poppins','Segoe UI',sans-serif", fontSize: 13, fontWeight: 700,
                            border: `1.5px solid ${isActive ? tab.activeBorder : "#e4ede8"}`,
                            background: isActive ? tab.activeBg : "#fff",
                            color: isActive ? tab.activeColor : "#6b7280",
                            boxShadow: isActive ? `0 2px 12px ${tab.activeBorder}80` : "0 1px 4px rgba(0,0,0,0.04)",
                          }}
                          onClick={() => setAssignSubTab(tab.id)}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                          {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: tab.dot, flexShrink: 0 }} />}
                          {tab.label}
                          <span style={{
                            background: isActive ? "rgba(0,0,0,0.08)" : "#f3f4f6",
                            color: isActive ? tab.activeColor : "#9ca3af",
                            fontSize: 11, fontWeight: 800, padding: "1px 8px", borderRadius: 20,
                          }}>{tab.count}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Cards for selected sub-tab, most recent first */}
                  {(() => {
                    const buckets = { upcoming: upcomingAssignments, live: liveAssignments, completed: completedAssignments };
                    const cards   = sortDesc(buckets[assignSubTab] || []);
                    const emptyMap = {
                      upcoming:  { Icon: Calendar,     title: "No upcoming assignments",  sub: "Future bookings you have been assigned will appear here." },
                      live:      { Icon: CheckSquare,  title: "No live assignments",      sub: "Bookings scheduled for today appear here while in progress." },
                      completed: { Icon: CheckCircle2, title: "No completed assignments", sub: "Assignments confirmed by you will appear here." },
                    };
                    const em = emptyMap[assignSubTab];
                    if (cards.length === 0) return (
                      <div style={s.emptyState}>
                        <em.Icon size={36} color="#d0ddd8" strokeWidth={1.5} />
                        <p style={s.emptyTitle}>{em.title}</p>
                        <p style={s.emptySub}>{em.sub}</p>
                      </div>
                    );
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {cards.map(booking => <AssignmentCard key={booking.id} booking={booking} />)}
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* ═══════ MY LABOURS ═══════ */}
              {activeTab === "labours" && (
                <motion.div key="labours" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.25 }}>
                  <div style={s.pageHeader}>
                    <div>
                      <h1 style={{ ...s.pageTitle, color: "#774936" }}>My Labours</h1>
                      <p style={s.pageSub}>{myLabours.length} team member{myLabours.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div style={{ ...s.bookingCard, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fdf6f3", border: "1px solid #f4c0a0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Plus size={14} color="#774936" strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.6px" }}>Add New Labour</span>
                    </div>
                    <form onSubmit={handleAddLabour} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input style={{ ...s.formInput, flex: 2, minWidth: 140 }} type="text" placeholder="Full name"
                        value={newName} onChange={e => setNewName(e.target.value)} />
                      <input style={{ ...s.formInput, flex: 1, minWidth: 120 }} type="tel" placeholder="Phone (10 digits)"
                        value={newPhone} onChange={e => setNewPhone(e.target.value)} maxLength={10} />
                      <motion.button type="submit" style={s.addBtn} disabled={loading}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        <Plus size={14} strokeWidth={2.5} /> Add
                      </motion.button>
                    </form>
                  </div>

                  {myLabours.length === 0 ? (
                    <div style={s.emptyState}>
                      <Users size={36} color="#d0ddd8" strokeWidth={1.5} />
                      <p style={s.emptyTitle}>No team members yet</p>
                      <p style={s.emptySub}>Add your first labour using the form above</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {myLabours.map(labour => {
                        const unavailKeys = Object.keys(labour.unavailability || {});
                        const isBusy = allBookings.some(b => b.status === "assigned" && b.assignedLabourIds?.includes(labour.id));
                        return (
                          <motion.div key={labour.id} style={s.labourCard}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -1 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
                              <div style={s.labourAvatar}>{labour.name[0]?.toUpperCase()}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1b4332" }}>{labour.name}</span>
                                  {isBusy && <span style={s.busyTag}>Assigned</span>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                                  <Phone size={11} color="#9ca3af" strokeWidth={2} />
                                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{labour.phone}</span>
                                </div>
                                {unavailKeys.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                                    {unavailKeys.map(key => {
                                      const [d, sl] = key.split("_");
                                      return (
                                        <div key={key} style={s.unavailTag}>
                                          <XCircle size={10} color="#dc2626" strokeWidth={2} />
                                          <span>{d} · {SLOT_CONFIG[sl]?.label || sl}</span>
                                          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2, fontWeight: 700 }}
                                            onClick={() => handleRemoveUnavailability(labour.id, key)}>×</button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                              <motion.button style={s.unavailBtn}
                                onClick={() => { setUnavailModal(labour); setUnavailDate(""); setUnavailReason(""); }}
                                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
                                <XCircle size={13} strokeWidth={2} /> Mark Unavailable
                              </motion.button>
                              <motion.button style={s.deleteBtn}
                                onClick={() => handleDeleteLabour(labour.id, labour.name)}
                                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
                                <Trash2 size={13} strokeWidth={2} />
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
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = {
  brand:    { display: "flex", alignItems: "center", gap: 10, padding: "22px 20px 18px" },
  brandMark:{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#774936,#4a2c20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 10px rgba(119,73,54,0.30)" },
  brandName:{ fontSize: 16, fontWeight: 800, color: "#1b4332", letterSpacing: "-0.3px" },
  brandSub: { fontSize: 9, color: "#774936", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 1 },

  profileCard:  { margin: "0 12px 14px", padding: "13px", background: "#fdf6f3", border: "1px solid #f4c0a0", borderRadius: 14, display: "flex", alignItems: "center", gap: 10 },
  profileAvatar:{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#774936,#c07850)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 },
  profileName:  { fontSize: 13, fontWeight: 700, color: "#4a2c20", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  profileMeta:  { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8aab97", marginTop: 3 },

  locationToggle:  { margin: "0 12px 14px", padding: "12px 14px", borderRadius: 12, border: "1px solid", transition: "all 0.2s" },
  navSectionLabel: { padding: "0 20px 8px", fontSize: 10, fontWeight: 700, color: "#c0d5c8", textTransform: "uppercase", letterSpacing: "1px" },
  navBtn:          { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 3, fontFamily: "'Poppins','Segoe UI',sans-serif", borderLeft: "3px solid transparent", transition: "all 0.15s" },
  navBtnLabel:     { fontSize: 13, fontWeight: 600, flex: 1, textAlign: "left" },
  navBadge:        { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 },
  statsRow:        { margin: "12px 12px 14px", padding: "14px 16px", background: "#f7faf8", border: "1px solid #e4ede8", borderRadius: 14, display: "flex" },
  logoutBtn:       { margin: "0 12px", padding: "11px 14px", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Poppins','Segoe UI',sans-serif" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(3px)" },
  modal:   { background: "#fff", border: "1px solid #e4ede8", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(27,67,50,0.15)" },
  modalTitle:      { fontSize: 18, fontWeight: 800, color: "#1b4332", margin: "0 0 4px", letterSpacing: "-0.3px" },
  modalSub:        { fontSize: 13, color: "#9ca3af", margin: "0 0 20px" },
  fieldLabel:      { display: "block", fontSize: 11, fontWeight: 700, color: "#5c7a6b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 7 },
  modalInput:      { width: "100%", padding: "11px 13px", background: "#fafcfb", border: "1.5px solid #e4ede8", borderRadius: 10, fontSize: 13.5, color: "#1a1a1a", boxSizing: "border-box", outline: "none", fontFamily: "'Poppins','Segoe UI',sans-serif", marginBottom: 14, transition: "border-color 0.18s, box-shadow 0.18s" },
  slotPill:        { display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, cursor: "pointer", border: "1.5px solid", fontFamily: "'Poppins','Segoe UI',sans-serif", fontSize: 12, fontWeight: 600, flex: 1, justifyContent: "center" },
  modalPrimaryBtn: { flex: 2, padding: "12px", background: "linear-gradient(135deg,#774936,#4a2c20)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Poppins','Segoe UI',sans-serif" },
  modalCancelBtn:  { flex: 1, padding: "12px", background: "#fff8f8", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins','Segoe UI',sans-serif" },

  assignSummary:      { background: "#fafcfb", border: "1px solid #e4ede8", borderRadius: 12, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 7 },
  sectionLabel:       { fontSize: 11, fontWeight: 700, color: "#5c7a6b", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" },
  labourSelectRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1.5px solid", transition: "all 0.15s" },
  labourSelectAvatar: { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 },

  pageHeader:{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, letterSpacing: "-0.5px" },
  pageSub:   { fontSize: 13, color: "#8aab97", marginTop: 4 },

  bookingCard:  { background: "#fff", border: "1px solid #e4ede8", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 6px rgba(27,67,50,0.05)", transition: "box-shadow 0.2s, transform 0.2s" },
  bTopBar:      { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  bDivider:     { height: 1, background: "#f0f4f2", margin: "14px 0" },
  bDetailsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px", marginBottom: 12 },
  bDetail:      { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" },
  dateBadge:    { display: "flex", alignItems: "center", gap: 5, background: "#f4fdf6", border: "1px solid #b7e4c7", padding: "4px 10px", borderRadius: 20, fontSize: 11, color: "#2d6a4f", fontWeight: 600 },
  slotBadge:    { display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "1px solid" },
  costTag:      { fontSize: 20, fontWeight: 900, color: "#1b4332", letterSpacing: "-0.5px" },

  mapsChip:  { display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", background: "#f4fdf6", border: "1px solid #b7e4c7", borderRadius: 9, marginBottom: 10 },
  availChip: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, border: "1px solid", marginBottom: 10 },
  assignBtn: { width: "100%", padding: "12px", background: "#fdf6f3", border: "1.5px solid #f4c0a0", borderRadius: 10, color: "#774936", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "'Poppins','Segoe UI',sans-serif" },

  attendanceBlock:    { background: "#fdf6f3", border: "1px solid #f4c0a0", borderRadius: 12, padding: "12px 14px", marginBottom: 12 },
  labourAttRow:       { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 11px", borderRadius: 9, border: "1px solid" },
  farmerConfirmedTag: { fontSize: 10, color: "#2d6a4f", background: "#f0fdf4", border: "1px solid #b7e4c7", padding: "2px 7px", borderRadius: 6, fontWeight: 600, flexShrink: 0 },

  confirmBtn:   { width: "100%", padding: 11, background: "#f4fdf6", border: "1.5px solid #86efac", borderRadius: 10, color: "#15803d", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "'Poppins','Segoe UI',sans-serif", marginTop: 4 },
  confirmedBar: { display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "#f4fdf6", border: "1px solid #b7e4c7", borderRadius: 9, fontSize: 12, color: "#15803d", fontWeight: 600, flexWrap: "wrap" },

  labourCard:  { background: "#fff", border: "1px solid #e4ede8", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, boxShadow: "0 1px 4px rgba(27,67,50,0.04)" },
  labourAvatar:{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#774936,#c07850)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 },
  busyTag:     { fontSize: 10, background: "#fef9f0", color: "#92400e", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 8, fontWeight: 700 },
  unavailTag:  { display: "flex", alignItems: "center", gap: 4, background: "#fff8f8", border: "1px solid #fecaca", padding: "3px 8px", borderRadius: 7, fontSize: 11, color: "#dc2626" },
  unavailBtn:  { display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "#fff8f8", border: "1px solid #fecaca", borderRadius: 9, color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins','Segoe UI',sans-serif", whiteSpace: "nowrap" },
  deleteBtn:   { padding: "7px 10px", background: "#fff8f8", border: "1px solid #fecaca", borderRadius: 9, color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", fontFamily: "'Poppins','Segoe UI',sans-serif" },

  formInput: { width: "100%", padding: "11px 13px", background: "#fafcfb", border: "1.5px solid #e4ede8", borderRadius: 10, fontSize: 13.5, color: "#1a1a1a", boxSizing: "border-box", outline: "none", fontFamily: "'Poppins','Segoe UI',sans-serif", transition: "border-color 0.18s, box-shadow 0.18s" },
  addBtn:    { padding: "11px 20px", background: "linear-gradient(135deg,#774936,#4a2c20)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Poppins','Segoe UI',sans-serif", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(119,73,54,0.28)" },

  emptyState:{ textAlign: "center", padding: "60px 40px", background: "#fff", border: "1px solid #e4ede8", borderRadius: 20, boxShadow: "0 1px 8px rgba(27,67,50,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  emptyTitle:{ fontSize: 18, fontWeight: 800, color: "#1b4332" },
  emptySub:  { fontSize: 13, color: "#9ca3af", lineHeight: 1.6 },
};