import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { auth, db } from "../../firebase";
import {
  collection, addDoc, query, where, doc,
  getDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Leaf, LogOut, Plus, Calendar, Clock, Users,
  MapPin, FileText, CheckCircle2, AlertCircle,
  Phone, User, Wallet, Sun, Sunset, Sunrise,
  ClipboardList, Menu, X,
} from "lucide-react";

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SLOT_CONFIG = {
  "8-12":  { label: "Morning",   time: "8:00 AM – 12:00 PM", icon: Sunrise, color: "#d97706", bg: "#fef3c7", border: "#fde68a", rate: 300 },
  "2-6":   { label: "Afternoon", time: "2:00 PM – 6:00 PM",  icon: Sunset,  color: "#ea580c", bg: "#ffedd5", border: "#fed7aa", rate: 300 },
  fullday: { label: "Full Day",  time: "8:00 AM – 6:00 PM",  icon: Sun,     color: "#16a34a", bg: "#dcfce7", border: "#86efac", rate: 600 },
};

const WORK_TYPES = [
  "🌾 Harvesting", "🌱 Planting", "🌿 Weeding",
  "💧 Irrigation",  "🧴 Spraying", "🚜 Tilling",
  "📦 Loading",     "📝 Other",
];

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({ click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function FarmerDashboard() {
  const [farmerData,   setFarmerData]   = useState(null);
  const [bookings,     setBookings]     = useState([]);
  const [allLabours,   setAllLabours]   = useState([]);
  const [allBookings,  setAllBookings]  = useState([]);
  const [activeTab,    setActiveTab]    = useState("book");
  const [loading,      setLoading]      = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  // Form state
  const [date,        setDate]        = useState("");
  const [slot,        setSlot]        = useState("8-12");
  const [workType,    setWorkType]    = useState("🌾 Harvesting");
  const [labourCount, setLabourCount] = useState(1);
  const [address,     setAddress]     = useState("");
  const [landmark,    setLandmark]    = useState("");
  const [description, setDescription] = useState("");

  // Map state
  const [farmLat,          setFarmLat]          = useState(null);
  const [farmLng,          setFarmLng]          = useState(null);
  const [locationFetching, setLocationFetching] = useState(false);
  const [mapReady,         setMapReady]         = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { navigate("/login"); return; }

    getDoc(doc(db, "users", user.uid)).then(d => { if (d.exists()) setFarmerData(d.data()); });

    const bq = query(collection(db, "bookings"), where("farmerId", "==", user.uid));
    const unsub1 = onSnapshot(bq, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0));
      setBookings(list);
    });
    const unsub2 = onSnapshot(collection(db, "bookings"), snap => setAllBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsub3 = onSnapshot(collection(db, "labours"),  snap => setAllLabours(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [navigate]);

  const getAvailableCount = (checkDate, checkSlot) => {
    if (!checkDate || !checkSlot) return 0;
    const busyIds = new Set();
    allBookings.forEach(b => {
      if (b.status !== "assigned" && b.status !== "completed") return;
      if (b.date !== checkDate || !b.assignedLabourIds?.length) return;
      if (b.timeSlot === checkSlot || b.timeSlot === "fullday" || checkSlot === "fullday")
        b.assignedLabourIds.forEach(id => busyIds.add(id));
    });
    return allLabours.filter(l => l.available === true && !busyIds.has(l.id)).length;
  };

  const availableNow  = getAvailableCount(date, slot);
  const ratePerLabour = SLOT_CONFIG[slot]?.rate || 300;
  const totalCost     = labourCount * ratePerLabour;

  const handleFetchLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported."); return; }
    setLocationFetching(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setFarmLat(lat); setFarmLng(lng); setMapReady(true);
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          toast.success("📍 Live location fetched!");
        } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); toast.success("📍 Location pinned!"); }
        setLocationFetching(false);
      },
      () => { toast.error("Location access denied."); setLocationFetching(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMapPinMove = async (lat, lng) => {
    setFarmLat(lat); setFarmLng(lng);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      toast.success("📍 Pin moved!");
    } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date)           { toast.error("Please select a date!"); return; }
    if (!address.trim()) { toast.error("Please enter farm address!"); return; }
    if (availableNow === 0)         { toast.error("No labours available!"); return; }
    if (labourCount < 1)            { toast.error("Select at least 1 labour!"); return; }
    if (labourCount > availableNow) { toast.error(`Only ${availableNow} labours available!`); return; }

    setLoading(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "bookings"), {
        farmerId: user.uid, farmerName: farmerData?.name, farmerPhone: farmerData?.phone,
        village: farmerData?.village, farmAddress: address, landmark,
        farmLat, farmLng, labourCount, timeSlot: slot, workType, date, description,
        totalCost, ratePerLabour, status: "pending",
        supervisorId: null, supervisorName: null, supervisorPhone: null,
        assignedLabour: 0, assignedLabourIds: [], assignedLabourNames: [],
        farmerConfirmed: false, supervisorConfirmed: false, labourAttendance: {}, createdAt: new Date(),
      });
      toast.success("Booking submitted successfully! 🌾");
      setDate(""); setAddress(""); setLandmark(""); setDescription("");
      setLabourCount(1); setSlot("8-12"); setFarmLat(null); setFarmLng(null); setMapReady(false);
      setActiveTab("bookings");
    } catch { toast.error("Failed to submit. Try again!"); }
    setLoading(false);
  };

  const handleMarkAttendance = async (bookingId, labourId, currentStatus) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      const updated = { ...(booking.labourAttendance || {}), [labourId]: !currentStatus };
      await updateDoc(doc(db, "bookings", bookingId), { labourAttendance: updated });
      toast.success(!currentStatus ? "Marked present ✅" : "Marked absent");
    } catch { toast.error("Failed to update."); }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { farmerConfirmed: true });
      toast.success("Work confirmed! ✅");
    } catch { toast.error("Failed to confirm."); }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  const getStatusConfig = (status) => {
    if (status === "pending")   return { color: "#b45309", bg: "#fef3c7", border: "#fde68a", label: "Pending",   icon: AlertCircle };
    if (status === "assigned")  return { color: "#15803d", bg: "#dcfce7", border: "#86efac", label: "Assigned",  icon: CheckCircle2 };
    if (status === "completed") return { color: "#4f46e5", bg: "#ede9fe", border: "#c4b5fd", label: "Completed", icon: CheckCircle2 };
    return { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", label: status, icon: AlertCircle };
  };

  const totalAvailableLabours = allLabours.filter(l => l.available === true).length;

  // Shared sidebar nav content (used in both desktop + mobile drawer)
  const SidebarNav = ({ onNavigate }) => (
    <>
      <div style={st.sidebarLogo}>
        <div style={st.logoIcon}><Leaf size={20} color="#16a34a" /></div>
        <div>
          <div style={st.logoTitle}>KrishiSetu</div>
          <div style={st.logoSub}>Farmer Portal</div>
        </div>
      </div>

      {farmerData && (
        <div style={st.farmerCard}>
          <div style={st.farmerAvatar}>{farmerData.name?.[0]?.toUpperCase()}</div>
          <div>
            <div style={st.farmerName}>{farmerData.name}</div>
            <div style={st.farmerMeta}>📍 {farmerData.village}</div>
            <div style={st.farmerMeta}>📞 {farmerData.phone}</div>
          </div>
        </div>
      )}

      <nav style={st.nav}>
        {[
          { id: "book",     icon: Plus,         label: "Book Labour" },
          { id: "bookings", icon: ClipboardList, label: "My Bookings", badge: bookings.length },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button key={item.id}
              style={{ ...st.navItem, backgroundColor: isActive ? "#dcfce7" : "transparent", borderLeft: `3px solid ${isActive ? "#16a34a" : "transparent"}` }}
              onClick={() => { setActiveTab(item.id); onNavigate?.(); }}
              whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}>
              <Icon size={17} color={isActive ? "#16a34a" : "#9ca3af"} />
              <span style={{ ...st.navLabel, color: isActive ? "#15803d" : "#6b7280" }}>{item.label}</span>
              {item.badge > 0 && <span style={st.navBadge}>{item.badge}</span>}
            </motion.button>
          );
        })}
      </nav>

      {/* <div style={st.liveBox}>
        <div style={st.liveDot} />
        <div>
          <div style={st.liveNum}>{totalAvailableLabours}</div>
          <div style={st.liveLabel}>Labours Available Now</div>
        </div>
      </div> */}

      {date && (
        <div style={st.slotPreviewBox}>
          <p style={st.slotPreviewTitle}>📅 {date}</p>
          {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = getAvailableCount(date, key);
            return (
              <div key={key} style={st.slotPreviewRow}>
                <Icon size={12} color={cfg.color} />
                <span style={{ color: "#9ca3af", fontSize: "11px" }}>{cfg.label}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "12px", color: count > 0 ? "#16a34a" : "#ef4444" }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <motion.button style={st.logoutBtn} onClick={handleLogout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <LogOut size={16} color="#ef4444" />
        <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: 600 }}>Logout</span>
      </motion.button>
    </>
  );

  return (
    <>
      {/* ── GLOBAL RESPONSIVE STYLES ── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; }

        .fd-root        { min-height: 100vh; display: flex; background: #f0fdf4; font-family: 'Inter','DM Sans','Segoe UI',sans-serif; color: #1a2e1a; }
        .fd-sidebar     { width: 260px; min-height: 100vh; background: #fff; border-right: 1px solid #e2e8f0; padding: 22px 0; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.04); }
        .fd-main-wrap   { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .fd-topbar      { display: none; }
        .fd-main        { flex: 1; padding: 28px 32px; overflow-y: auto; }
        .fd-overlay     { display: none; }
        .fd-drawer      { display: none; }

        .fd-form-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .fd-avail-grid  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
        .fd-work-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .fd-booking-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }

        @media (max-width: 900px) {
          .fd-sidebar   { display: none; }
          .fd-topbar    { display: flex; position: sticky; top: 0; z-index: 30; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 12px 16px; align-items: center; justify-content: space-between; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
          .fd-main      { padding: 16px; }
          .fd-overlay   { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 40; }
          .fd-drawer    { display: flex; flex-direction: column; position: fixed; left: 0; top: 0; height: 100vh; width: 270px; background: #fff; z-index: 50; overflow-y: auto; padding: 22px 0; box-shadow: 4px 0 24px rgba(0,0,0,0.12); }
        }

        @media (max-width: 700px) {
          .fd-form-grid  { grid-template-columns: 1fr; }
          .fd-avail-grid { grid-template-columns: 1fr 1fr 1fr; }
        }

        @media (max-width: 480px) {
          .fd-avail-grid           { grid-template-columns: 1fr; }
          .fd-booking-detail-grid  { grid-template-columns: 1fr; }
          .fd-work-grid            { grid-template-columns: 1fr 1fr; }
        }

        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        input:focus, textarea:focus { outline: none; border-color: #86efac !important; box-shadow: 0 0 0 3px rgba(134,239,172,0.2); }

        @keyframes fd-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.15); } }
        .fd-live-dot { animation: fd-pulse 2s ease-in-out infinite; }
      `}</style>

      <div className="fd-root">
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: "inherit", fontSize: "13px", borderRadius: "10px" } }} />

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="fd-sidebar">
          <SidebarNav />
        </aside>

        {/* ── MOBILE OVERLAY ── */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div className="fd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
              <motion.div className="fd-drawer" initial={{ x: -270 }} animate={{ x: 0 }} exit={{ x: -270 }} transition={{ type: "tween", duration: 0.22 }}>
                <button onClick={() => setSidebarOpen(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#9ca3af" }}>
                  <X size={20} />
                </button>
                <SidebarNav onNavigate={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="fd-main-wrap">

          {/* ── MOBILE TOP BAR ── */}
          <div className="fd-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#16a34a,#4ade80)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Leaf size={16} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#14532d" }}>KrishiSetu</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, background: "#dcfce7", padding: "4px 10px", borderRadius: 20, border: "1px solid #86efac" }}>
                🟢 {totalAvailableLabours} available
              </div>
              <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#374151" }}>
                <Menu size={22} />
              </button>
            </div>
          </div>

          {/* ── MAIN CONTENT ── */}
          <main className="fd-main">
            <AnimatePresence mode="wait">

              {/* ─── BOOK TAB ─── */}
              {activeTab === "book" && (
                <motion.div key="book" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>

                  {/* Page Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#14532d", letterSpacing: "-0.5px" }}>Book Labour</h1>
                      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Request agricultural workers for your farm</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1.5px solid #bbf7d0", padding: "8px 14px", borderRadius: 20, fontSize: 12, color: "#15803d", fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", whiteSpace: "nowrap" }}>
                      <Wallet size={13} color="#16a34a" /> ₹300/slot · ₹600/full day
                    </div>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div className="fd-form-grid">

                      {/* ── LEFT COLUMN ── */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* Date & Availability */}
                        <div style={st.card}>
                          <div style={st.cardHeader}>
                            <div style={{ ...st.cardIconBg, background: "#dcfce7" }}><Calendar size={14} color="#16a34a" /></div>
                            <span style={st.cardTitle}>Date & Availability</span>
                          </div>
                          <input style={st.input} type="date" value={date}
                            onChange={e => { setDate(e.target.value); setLabourCount(1); }}
                            min={new Date().toISOString().split("T")[0]} required />

                          {date && (
                            <motion.div className="fd-avail-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
                                const Icon = cfg.icon;
                                const count = getAvailableCount(date, key);
                                const isSelected = slot === key;
                                return (
                                  <motion.button key={key} type="button"
                                    style={{
                                      display: "flex", flexDirection: "column", alignItems: "center",
                                      gap: 3, padding: "11px 6px", borderRadius: 12,
                                      cursor: count === 0 ? "not-allowed" : "pointer",
                                      border: `2px solid ${isSelected ? cfg.color : count > 0 ? "#e5e7eb" : "#fca5a5"}`,
                                      background: isSelected ? cfg.bg : count > 0 ? "#fff" : "#fef2f2",
                                      opacity: count === 0 ? 0.55 : 1, position: "relative",
                                      transition: "all 0.18s", fontFamily: "inherit",
                                      boxShadow: isSelected ? `0 0 0 3px ${cfg.color}30` : "0 1px 3px rgba(0,0,0,0.05)",
                                    }}
                                    onClick={() => { if (count > 0) { setSlot(key); setLabourCount(1); } else toast.error("No labours for this slot!"); }}
                                    whileHover={{ scale: count > 0 ? 1.04 : 1 }}
                                    whileTap={{ scale: count > 0 ? 0.96 : 1 }}
                                  >
                                    <Icon size={17} color={count > 0 ? cfg.color : "#d1d5db"} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? cfg.color : count > 0 ? "#374151" : "#9ca3af" }}>{cfg.label}</span>
                                    <span style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", lineHeight: 1.3 }}>{cfg.time}</span>
                                    <div style={{ marginTop: 3, padding: "2px 7px", borderRadius: 20, background: count > 0 ? "#dcfce7" : "#fee2e2" }}>
                                      <span style={{ fontSize: 10, fontWeight: 800, color: count > 0 ? "#15803d" : "#dc2626" }}>{count} avail.</span>
                                    </div>
                                    <span style={{ fontSize: 9, color: "#9ca3af" }}>₹{cfg.rate}/ea</span>
                                    {isSelected && <div style={{ position: "absolute", top: 6, right: 7, fontSize: 10, color: cfg.color, fontWeight: 900 }}>✓</div>}
                                  </motion.button>
                                );
                              })}
                            </motion.div>
                          )}

                          {!date && (
                            <div style={{ marginTop: 12, padding: "11px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 12, color: "#9ca3af", textAlign: "center", border: "1px dashed #cbd5e1" }}>
                              👆 Select a date to see live slot availability
                            </div>
                          )}
                        </div>

                        {/* Work Type */}
                        <div style={st.card}>
                          <div style={st.cardHeader}>
                            <div style={{ ...st.cardIconBg, background: "#fef3c7" }}><FileText size={14} color="#d97706" /></div>
                            <span style={st.cardTitle}>Type of Work</span>
                          </div>
                          <div className="fd-work-grid">
                            {WORK_TYPES.map(w => (
                              <motion.button key={w} type="button"
                                style={{
                                  padding: "9px 8px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                                  background: workType === w ? "#dcfce7" : "#f9fafb",
                                  border: `1.5px solid ${workType === w ? "#86efac" : "#e5e7eb"}`,
                                  color: workType === w ? "#15803d" : "#6b7280",
                                  boxShadow: workType === w ? "0 0 0 2px #bbf7d050" : "none",
                                }}
                                onClick={() => setWorkType(w)}
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                {w}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Farm Location */}
                        <div style={st.card}>
                          <div style={st.cardHeader}>
                            <div style={{ ...st.cardIconBg, background: "#dbeafe" }}><MapPin size={14} color="#2563eb" /></div>
                            <span style={st.cardTitle}>Farm Location</span>
                          </div>

                          {/* GPS Button */}
                          <motion.button type="button"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                              width: "100%", padding: "11px 14px", marginBottom: 12,
                              background: locationFetching ? "#f0fdf4" : "#dcfce7",
                              border: "1.5px solid #86efac", borderRadius: 10,
                              color: "#15803d", fontSize: 13, fontWeight: 700,
                              cursor: locationFetching ? "not-allowed" : "pointer", fontFamily: "inherit",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                            }}
                            onClick={handleFetchLocation} disabled={locationFetching}
                            whileHover={{ scale: locationFetching ? 1 : 1.02 }}
                            whileTap={{ scale: locationFetching ? 1 : 0.97 }}>
                            {locationFetching ? (
                              <motion.div style={{ width: 14, height: 14, border: "2px solid #bbf7d0", borderTop: "2px solid #16a34a", borderRadius: "50%" }}
                                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
                            ) : <MapPin size={14} />}
                            {locationFetching ? "Fetching location..." : "📡 Use My Live Location"}
                          </motion.button>

                          {/* Leaflet Map */}
                          {mapReady && farmLat && farmLng && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                              style={{ borderRadius: 12, overflow: "hidden", marginBottom: 12, border: "1.5px solid #86efac", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                              <MapContainer key={`${farmLat}-${farmLng}`} center={[farmLat, farmLng]} zoom={15} style={{ height: 200, width: "100%" }} scrollWheelZoom={false}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                                <Marker position={[farmLat, farmLng]} />
                                <MapClickHandler onLocationSelect={handleMapPinMove} />
                              </MapContainer>
                              <div style={{ padding: "6px 12px", background: "#f0fdf4", borderTop: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>🗺️ Tap map to adjust pin</span>
                                <span style={{ fontSize: 10, color: "#9ca3af" }}>{farmLat?.toFixed(5)}, {farmLng?.toFixed(5)}</span>
                              </div>
                            </motion.div>
                          )}

                          <textarea style={{ ...st.input, minHeight: 72, resize: "vertical" }}
                            placeholder="Full farm address (village, taluka, district)..."
                            value={address} onChange={e => setAddress(e.target.value)} required />
                          <input style={{ ...st.input, marginTop: 10 }} type="text"
                            placeholder="Landmark (e.g. near Shiva temple, highway junction)"
                            value={landmark} onChange={e => setLandmark(e.target.value)} />
                        </div>
                      </div>

                      {/* ── RIGHT COLUMN ── */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* Labour Count + Cost */}
                        <div style={st.card}>
                          <div style={st.cardHeader}>
                            <div style={{ ...st.cardIconBg, background: "#ede9fe" }}><Users size={14} color="#7c3aed" /></div>
                            <span style={st.cardTitle}>Labour Count & Cost</span>
                          </div>

                          {availableNow === 0 && date ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 10, marginBottom: 12 }}>
                              <AlertCircle size={18} color="#dc2626" />
                              <div>
                                <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 14 }}>No Labours Available</p>
                                <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>Try a different date or slot</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 12 }}>
                                <motion.button type="button"
                                  style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0fdf4", border: "1.5px solid #86efac", color: "#16a34a", fontSize: 22, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                  onClick={() => setLabourCount(Math.max(1, labourCount - 1))} whileTap={{ scale: 0.9 }}>−</motion.button>
                                <div style={{ textAlign: "center" }}>
                                  <span style={{ fontSize: 42, fontWeight: 900, color: "#14532d", lineHeight: 1, display: "block" }}>{labourCount}</span>
                                  <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, display: "block" }}>of {availableNow} available</span>
                                </div>
                                <motion.button type="button"
                                  style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0fdf4", border: "1.5px solid #86efac", color: "#16a34a", fontSize: 22, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                  onClick={() => setLabourCount(Math.min(availableNow, labourCount + 1))} whileTap={{ scale: 0.9 }}>+</motion.button>
                              </div>

                              <div style={{ height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                                <motion.div style={{ height: "100%", background: "linear-gradient(90deg,#16a34a,#4ade80)", borderRadius: 4 }}
                                  animate={{ width: `${(labourCount / availableNow) * 100}%` }} transition={{ duration: 0.3 }} />
                              </div>
                              <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", margin: "4px 0 14px" }}>{labourCount} of {availableNow} selected</p>
                            </>
                          )}

                          {/* Cost Breakdown */}
                          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                              <span style={{ fontSize: 12, color: "#6b7280" }}>Labour Count</span>
                              <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>{labourCount}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                              <span style={{ fontSize: 12, color: "#6b7280" }}>Rate per Labour</span>
                              <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>₹{ratePerLabour} ({SLOT_CONFIG[slot]?.label})</span>
                            </div>
                            <div style={{ height: 1, background: "#bbf7d0", margin: "10px 0" }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: "#14532d" }}>Total Cost</span>
                              <span style={{ fontSize: 28, fontWeight: 900, color: "#16a34a" }}>₹{totalCost.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Additional Notes */}
                        <div style={st.card}>
                          <div style={st.cardHeader}>
                            <div style={{ ...st.cardIconBg, background: "#e0f2fe" }}><FileText size={14} color="#0284c7" /></div>
                            <span style={st.cardTitle}>Additional Notes</span>
                          </div>
                          <textarea style={{ ...st.input, minHeight: 90, resize: "vertical" }}
                            placeholder="Field size, tools needed, specific instructions..."
                            value={description} onChange={e => setDescription(e.target.value)} />
                        </div>

                        {/* Submit Button */}
                        <motion.button type="submit"
                          style={{
                            width: "100%", padding: "15px",
                            background: (loading || (date && availableNow === 0)) ? "#e5e7eb" : "linear-gradient(135deg,#16a34a,#4ade80)",
                            border: "none", borderRadius: 14,
                            fontSize: 15, fontWeight: 800,
                            color: (loading || (date && availableNow === 0)) ? "#9ca3af" : "#fff",
                            cursor: (date && availableNow === 0) ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            fontFamily: "inherit",
                            boxShadow: (loading || (date && availableNow === 0)) ? "none" : "0 4px 20px rgba(22,163,74,0.35)",
                            transition: "all 0.2s",
                          }}
                          disabled={loading || (date && availableNow === 0)}
                          whileHover={{ scale: (loading || (date && availableNow === 0)) ? 1 : 1.02, y: (loading || (date && availableNow === 0)) ? 0 : -2 }}
                          whileTap={{ scale: 0.98 }}>
                          {loading ? (
                            <motion.div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.4)", borderTop: "2.5px solid #fff", borderRadius: "50%" }}
                              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
                          ) : (
                            date && availableNow === 0 ? "❌ No Labours Available" : `🌾 Submit Booking · ₹${totalCost.toLocaleString()}`
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ─── BOOKINGS TAB ─── */}
              {activeTab === "bookings" && (
                <motion.div key="bookings" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#14532d", letterSpacing: "-0.5px" }}>My Bookings</h1>
                      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{bookings.length} total booking{bookings.length !== 1 ? "s" : ""}</p>
                    </div>
                    <motion.button
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "#dcfce7", border: "1.5px solid #86efac", borderRadius: 10, color: "#15803d", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                      onClick={() => setActiveTab("book")} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Plus size={14} /> New Booking
                    </motion.button>
                  </div>

                  {bookings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "72px 40px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 56, marginBottom: 16 }}>🌾</div>
                      <p style={{ fontSize: 20, fontWeight: 800, color: "#14532d", marginBottom: 8 }}>No bookings yet!</p>
                      <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24 }}>Request your first labour booking</p>
                      <motion.button style={{ padding: "12px 28px", background: "linear-gradient(135deg,#16a34a,#4ade80)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(22,163,74,0.3)" }}
                        onClick={() => setActiveTab("book")} whileHover={{ scale: 1.03 }}>+ Book Labour</motion.button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {bookings.map(booking => {
                        const sc         = getStatusConfig(booking.status);
                        const StatusIcon = sc.icon;
                        const slotCfg    = SLOT_CONFIG[booking.timeSlot];
                        const SlotIcon   = slotCfg?.icon || Clock;
                        const presentCount = Object.values(booking.labourAttendance || {}).filter(Boolean).length;
                        const absentCount  = (booking.assignedLabour || 0) - presentCount;

                        return (
                          <motion.div key={booking.id}
                            style={{ background: "#fff", border: `1.5px solid ${sc.border}`, borderRadius: 16, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -2, boxShadow: "0 6px 24px rgba(0,0,0,0.08)" }}>

                            {/* Card Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "4px 10px", borderRadius: 20, fontSize: 12, color: "#15803d", fontWeight: 600 }}>
                                  <Calendar size={11} color="#16a34a" /> {booking.date}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, background: sc.bg, border: `1px solid ${sc.border}`, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: sc.color, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                                  <StatusIcon size={10} /> {sc.label}
                                </div>
                              </div>
                              <span style={{ fontSize: 18, fontWeight: 900, color: "#14532d" }}>
                                ₹{(booking.totalCost || (booking.labourCount * (SLOT_CONFIG[booking.timeSlot]?.rate || 300))).toLocaleString()}
                              </span>
                            </div>

                            {/* Details Grid */}
                            <div className="fd-booking-detail-grid">
                              <div style={st.bDetail}><SlotIcon size={13} color={slotCfg?.color || "#9ca3af"} /><span>{slotCfg?.label} · {slotCfg?.time}</span></div>
                              <div style={st.bDetail}><Users size={13} color="#9ca3af" /><span>{booking.labourCount} labours · ₹{slotCfg?.rate || 300}/each</span></div>
                              <div style={st.bDetail}><FileText size={13} color="#9ca3af" /><span>{booking.workType || "General"}</span></div>
                              <div style={{ ...st.bDetail, overflow: "hidden" }}><MapPin size={13} color="#9ca3af" style={{ flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.farmAddress || booking.village}</span></div>
                              {booking.landmark && (
                                <div style={st.bDetail}><MapPin size={12} color="#d1d5db" /><span style={{ color: "#9ca3af" }}>📍 {booking.landmark}</span></div>
                              )}
                              {booking.farmLat && booking.farmLng && (
                                <div style={st.bDetail}>
                                  <MapPin size={13} color="#2563eb" />
                                  <a href={`https://www.google.com/maps?q=${booking.farmLat},${booking.farmLng}`} target="_blank" rel="noopener noreferrer"
                                    style={{ color: "#2563eb", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>📍 View on Google Maps</a>
                                </div>
                              )}
                            </div>

                            {/* Supervisor */}
                            {booking.status === "assigned" && booking.supervisorName && (
                              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                  <User size={12} color="#2563eb" />
                                  <span style={{ color: "#2563eb", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Assigned Supervisor</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#dbeafe", border: "1.5px solid #93c5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#2563eb", flexShrink: 0 }}>
                                    {booking.supervisorName[0]}
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f" }}>{booking.supervisorName}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                      <Phone size={10} color="#2563eb" />
                                      <span style={{ fontSize: 12, color: "#2563eb" }}>{booking.supervisorPhone}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Labours + Attendance */}
                            {booking.status === "assigned" && booking.assignedLabourNames?.length > 0 && (
                              <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                                  <Users size={12} color="#7c3aed" />
                                  <span style={{ color: "#7c3aed", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Assigned Labours ({booking.assignedLabour})</span>
                                  <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 10 }}>Tap to mark</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {booking.assignedLabourNames.map((name, idx) => {
                                    const labourId = booking.assignedLabourIds?.[idx];
                                    const isPresent = booking.labourAttendance?.[labourId] === true;
                                    return (
                                      <motion.div key={idx}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 11px", borderRadius: 8, background: isPresent ? "#f0fdf4" : "#fff", border: `1px solid ${isPresent ? "#86efac" : "#e5e7eb"}` }}
                                        whileHover={{ scale: 1.01 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isPresent ? "#16a34a" : "#d1d5db", flexShrink: 0 }} />
                                          <span style={{ fontSize: 13, color: isPresent ? "#14532d" : "#6b7280", fontWeight: isPresent ? 600 : 400 }}>👤 {name}</span>
                                        </div>
                                        <motion.button
                                          style={{ padding: "5px 11px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", fontFamily: "inherit", background: isPresent ? "#dcfce7" : "#f3f4f6", color: isPresent ? "#15803d" : "#9ca3af", flexShrink: 0 }}
                                          onClick={() => handleMarkAttendance(booking.id, labourId, isPresent)} whileTap={{ scale: 0.93 }}>
                                          {isPresent ? "✅ Present" : "Mark Present"}
                                        </motion.button>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                                <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 8, borderTop: "1px solid #e9d5ff" }}>
                                  <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 600 }}>✅ {presentCount} present</span>
                                  <span style={{ color: absentCount > 0 ? "#dc2626" : "#9ca3af", fontSize: 12, fontWeight: 600 }}>❌ {absentCount} absent</span>
                                </div>
                              </div>
                            )}

                            {/* Confirm Work */}
                            {booking.status === "assigned" && !booking.farmerConfirmed && (
                              <motion.button
                                style={{ width: "100%", padding: 11, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, color: "#15803d", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit", marginTop: 4 }}
                                onClick={() => handleConfirmBooking(booking.id)}
                                whileHover={{ background: "#dcfce7", scale: 1.01 }} whileTap={{ scale: 0.97 }}>
                                <CheckCircle2 size={15} /> Confirm Work Completed
                              </motion.button>
                            )}

                            {booking.farmerConfirmed && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", marginTop: 4, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#15803d", fontWeight: 600, flexWrap: "wrap" }}>
                                <CheckCircle2 size={13} color="#16a34a" />
                                <span>You confirmed work completion</span>
                                {!booking.supervisorConfirmed && <span style={{ color: "#b45309", fontSize: 11 }}>· Waiting for supervisor</span>}
                                {booking.supervisorConfirmed && <span style={{ color: "#16a34a", fontSize: 11 }}>· Supervisor confirmed ✅</span>}
                              </div>
                            )}
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

// ── LIGHT THEME STYLES ──
const st = {
  sidebarLogo: { display: "flex", alignItems: "center", gap: 10, padding: "0 20px 18px", borderBottom: "1px solid #f0fdf4" },
  logoIcon:    { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#16a34a,#4ade80)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" },
  logoTitle:   { fontSize: 15, fontWeight: 800, color: "#14532d" },
  logoSub:     { fontSize: 10, color: "#16a34a", fontWeight: 600 },
  farmerCard:  { margin: "14px 12px", padding: 14, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 },
  farmerAvatar:{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#16a34a,#4ade80)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 },
  farmerName:  { fontSize: 13, fontWeight: 700, color: "#14532d", marginBottom: 2 },
  farmerMeta:  { fontSize: 11, color: "#6b7280" },
  nav:         { padding: "14px 12px", flex: 1 },
  navItem:     { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 4, transition: "all 0.2s", background: "transparent" },
  navLabel:    { fontSize: 13, fontWeight: 600, flex: 1, textAlign: "left" },
  navBadge:    { background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 },
  liveBox:     { margin: "0 12px 12px", padding: 14, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 },
  liveDot:     { width: 10, height: 10, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 0 3px #bbf7d0", flexShrink: 0 },
  liveNum:     { fontSize: 22, fontWeight: 800, color: "#16a34a", lineHeight: 1 },
  liveLabel:   { fontSize: 11, color: "#6b7280", marginTop: 2 },
  slotPreviewBox:   { margin: "0 12px 12px", padding: 12, background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10 },
  slotPreviewTitle: { fontSize: 11, fontWeight: 700, color: "#16a34a", margin: "0 0 8px" },
  slotPreviewRow:   { display: "flex", alignItems: "center", gap: 6, marginBottom: 5 },
  logoutBtn:   { margin: "0 12px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 },
  card:        { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  cardHeader:  { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  cardIconBg:  { width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle:   { fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" },
  input:       { width: "100%", padding: "11px 13px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, color: "#1f2937", boxSizing: "border-box", outline: "none", fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s" },
  bDetail:     { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" },
};