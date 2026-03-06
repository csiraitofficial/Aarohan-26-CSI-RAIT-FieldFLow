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
  ClipboardList, ChevronDown,
} from "lucide-react";

// Fix Leaflet default marker icon (common CRA issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SLOT_CONFIG = {
  "8-12": { label: "Morning", time: "8:00 AM – 12:00 PM", icon: Sunrise, color: "#f59e0b", rate: 300 },
  "2-6":  { label: "Afternoon", time: "2:00 PM – 6:00 PM", icon: Sunset, color: "#f97316", rate: 300 },
  fullday: { label: "Full Day", time: "8:00 AM – 6:00 PM", icon: Sun, color: "#10b981", rate: 600 },
};

const WORK_TYPES = [
  "🌾 Harvesting", "🌱 Planting", "🌿 Weeding",
  "💧 Irrigation", "🧴 Spraying", "🚜 Tilling",
  "📦 Loading", "📝 Other"
];

// Allows clicking on the map to move the pin
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FarmerDashboard() {
  const [farmerData, setFarmerData]   = useState(null);
  const [bookings, setBookings]       = useState([]);
  const [allLabours, setAllLabours]   = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [activeTab, setActiveTab]     = useState("book");
  const [loading, setLoading]         = useState(false);

  // Form
  const [date, setDate]               = useState("");
  const [slot, setSlot]               = useState("8-12");
  const [workType, setWorkType]       = useState("🌾 Harvesting");
  const [labourCount, setLabourCount] = useState(1);
  const [address, setAddress]         = useState("");
  const [landmark, setLandmark]       = useState("");
  const [description, setDescription] = useState("");

  // Live location / map
  const [farmLat, setFarmLat]                   = useState(null);
  const [farmLng, setFarmLng]                   = useState(null);
  const [locationFetching, setLocationFetching] = useState(false);
  const [mapReady, setMapReady]                 = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { navigate("/login"); return; }

    // Load farmer profile
    getDoc(doc(db, "users", user.uid)).then(d => {
      if (d.exists()) setFarmerData(d.data());
    });

    // My bookings
    const bq = query(collection(db, "bookings"), where("farmerId", "==", user.uid));
    const unsub1 = onSnapshot(bq, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0));
      setBookings(list);
    });

    // ALL bookings (for availability calculation)
    const unsub2 = onSnapshot(collection(db, "bookings"), snap => {
      setAllBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // ALL labours
    const unsub3 = onSnapshot(collection(db, "labours"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllLabours(list);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [navigate]);

  // ── CORE AVAILABILITY LOGIC ──
  const getAvailableCount = (checkDate, checkSlot) => {
    if (!checkDate || !checkSlot) return 0;

    const busyIds = new Set();
    allBookings.forEach(b => {
      if (b.status !== "assigned" && b.status !== "completed") return;
      if (b.date !== checkDate) return;
      if (!b.assignedLabourIds?.length) return;

      const overlaps =
        b.timeSlot === checkSlot ||
        b.timeSlot === "fullday" ||
        checkSlot === "fullday";

      if (overlaps) {
        b.assignedLabourIds.forEach(id => busyIds.add(id));
      }
    });

    return allLabours.filter(l => l.available === true && !busyIds.has(l.id)).length;
  };

  const availableNow = getAvailableCount(date, slot);
  const ratePerLabour = SLOT_CONFIG[slot]?.rate || 300;
  const totalCost = labourCount * ratePerLabour;

  // ── FETCH LIVE LOCATION ──
  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser.");
      return;
    }
    setLocationFetching(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFarmLat(lat);
        setFarmLng(lng);
        setMapReady(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await res.json();
          setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          toast.success("📍 Live location fetched!");
        } catch {
          setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          toast.success("📍 Location pinned on map!");
        }
        setLocationFetching(false);
      },
      () => {
        toast.error("Location access denied. Please allow location in browser.");
        setLocationFetching(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── MAP PIN DRAG / CLICK ──
  const handleMapPinMove = async (lat, lng) => {
    setFarmLat(lat);
    setFarmLng(lng);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      toast.success("📍 Pin moved!");
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date)          { toast.error("Please select a date!"); return; }
    if (!address.trim()){ toast.error("Please enter farm address!"); return; }
    if (availableNow === 0) { toast.error("No labours available for this date & slot!"); return; }
    if (labourCount < 1)    { toast.error("Select at least 1 labour!"); return; }
    if (labourCount > availableNow) {
      toast.error(`Only ${availableNow} labours available! Reduce count.`); return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "bookings"), {
        farmerId:         user.uid,
        farmerName:       farmerData?.name,
        farmerPhone:      farmerData?.phone,
        village:          farmerData?.village,
        farmAddress:      address,
        landmark,
        farmLat:          farmLat,
        farmLng:          farmLng,
        labourCount,
        timeSlot:         slot,
        workType,
        date,
        description,
        totalCost,
        ratePerLabour,
        status:           "pending",
        supervisorId:     null,
        supervisorName:   null,
        supervisorPhone:  null,
        assignedLabour:   0,
        assignedLabourIds:   [],
        assignedLabourNames: [],
        farmerConfirmed:     false,
        supervisorConfirmed: false,
        labourAttendance:    {},
        createdAt:           new Date(),
      });
      toast.success("Booking submitted successfully! 🌾");
      setDate(""); setAddress(""); setLandmark(""); setDescription("");
      setLabourCount(1); setSlot("8-12");
      setFarmLat(null); setFarmLng(null); setMapReady(false);
      setActiveTab("bookings");
    } catch (err) {
      toast.error("Failed to submit. Try again!");
    }
    setLoading(false);
  };

  const handleMarkAttendance = async (bookingId, labourId, currentStatus) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      const updated = { ...(booking.labourAttendance || {}), [labourId]: !currentStatus };
      await updateDoc(doc(db, "bookings", bookingId), { labourAttendance: updated });
      toast.success(!currentStatus ? "Marked present ✅" : "Marked absent");
    } catch {
      toast.error("Failed to update.");
    }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { farmerConfirmed: true });
      toast.success("Work confirmed! ✅");
    } catch {
      toast.error("Failed to confirm.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const getStatusConfig = (status) => {
    if (status === "pending")   return { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Pending",   icon: AlertCircle };
    if (status === "assigned")  return { color: "#10b981", bg: "rgba(16,185,129,0.12)",  label: "Assigned",  icon: CheckCircle2 };
    if (status === "completed") return { color: "#6366f1", bg: "rgba(99,102,241,0.12)",  label: "Completed", icon: CheckCircle2 };
    return { color: "#888", bg: "rgba(136,136,136,0.1)", label: status, icon: AlertCircle };
  };

  const totalAvailableLabours = allLabours.filter(l => l.available === true).length;

  return (
    <div style={styles.root}>
      <Toaster position="top-right" />

      {/* ── SIDEBAR ── */}
      <motion.aside style={styles.sidebar}
        initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>

        {/* Logo */}
        <div style={styles.sidebarLogo}>
          <div style={styles.logoIcon}><Leaf size={20} color="#4ade80" /></div>
          <div>
            <div style={styles.logoTitle}>KrishiSetu</div>
            <div style={styles.logoSub}>Farmer Portal</div>
          </div>
        </div>

        {/* Farmer Profile */}
        {farmerData && (
          <div style={styles.farmerCard}>
            <div style={styles.farmerAvatar}>{farmerData.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={styles.farmerName}>{farmerData.name}</div>
              <div style={styles.farmerMeta}>📍 {farmerData.village}</div>
              <div style={styles.farmerMeta}>📞 {farmerData.phone}</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={styles.nav}>
          {[
            { id: "book",     icon: Plus,         label: "Book Labour" },
            { id: "bookings", icon: ClipboardList, label: "My Bookings", badge: bookings.length },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button key={item.id}
                style={{ ...styles.navItem,
                  backgroundColor: isActive ? "rgba(74,222,128,0.1)" : "transparent",
                  borderLeft: `3px solid ${isActive ? "#4ade80" : "transparent"}`,
                }}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }}
              >
                <Icon size={18} color={isActive ? "#4ade80" : "#555"} />
                <span style={{ ...styles.navLabel, color: isActive ? "#4ade80" : "#777" }}>{item.label}</span>
                {item.badge > 0 && <span style={styles.navBadge}>{item.badge}</span>}
              </motion.button>
            );
          })}
        </nav>

        {/* Live Stats */}
        <div style={styles.liveBox}>
          <div style={styles.liveDot} />
          <div>
            <div style={styles.liveNum}>{totalAvailableLabours}</div>
            <div style={styles.liveLabel}>Labours Available Now</div>
          </div>
        </div>

        {/* Slot availability preview */}
        {date && (
          <div style={styles.slotPreviewBox}>
            <p style={styles.slotPreviewTitle}>📅 {date}</p>
            {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const count = getAvailableCount(date, key);
              return (
                <div key={key} style={styles.slotPreviewRow}>
                  <Icon size={12} color={cfg.color} />
                  <span style={{ color: "#888", fontSize: "11px" }}>{cfg.label}</span>
                  <span style={{
                    marginLeft: "auto", fontWeight: 700, fontSize: "12px",
                    color: count > 0 ? "#4ade80" : "#ef4444"
                  }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Logout */}
        <motion.button style={styles.logoutBtn} onClick={handleLogout}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <LogOut size={16} color="#ef4444" />
          <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: 600 }}>Logout</span>
        </motion.button>
      </motion.aside>

      {/* ── MAIN ── */}
      <main style={styles.main}>
        <AnimatePresence mode="wait">

          {/* ───── BOOK TAB ───── */}
          {activeTab === "book" && (
            <motion.div key="book"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              <div style={styles.pageHeader}>
                <div>
                  <h1 style={styles.pageTitle}>Book Labour</h1>
                  <p style={styles.pageSubtitle}>Request agricultural workers for your farm</p>
                </div>
                <div style={styles.rateTag}>
                  <Wallet size={14} color="#4ade80" />
                  <span>₹300/slot · ₹600/full day</span>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={styles.formGrid}>

                  {/* ── LEFT ── */}
                  <div style={styles.col}>

                    {/* Date + live availability */}
                    <div style={styles.card}>
                      <div style={styles.cardHeader}><Calendar size={15} color="#4ade80" /><span style={styles.cardTitle}>Date & Availability</span></div>
                      <input style={styles.input} type="date" value={date}
                        onChange={e => { setDate(e.target.value); setLabourCount(1); }}
                        min={new Date().toISOString().split("T")[0]} required />

                      {/* Live availability per slot for chosen date */}
                      {date && (
                        <motion.div style={styles.availGrid}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
                            const Icon = cfg.icon;
                            const count = getAvailableCount(date, key);
                            const isSelected = slot === key;
                            return (
                              <motion.button key={key} type="button"
                                style={{
                                  ...styles.availSlotCard,
                                  border: `2px solid ${isSelected ? cfg.color : count > 0 ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.2)"}`,
                                  backgroundColor: isSelected ? `${cfg.color}15` : count > 0 ? "rgba(255,255,255,0.02)" : "rgba(239,68,68,0.04)",
                                  opacity: count === 0 ? 0.6 : 1,
                                }}
                                onClick={() => { if (count > 0) { setSlot(key); setLabourCount(1); } else toast.error("No labours available for this slot!"); }}
                                whileHover={{ scale: count > 0 ? 1.03 : 1 }}
                                whileTap={{ scale: count > 0 ? 0.97 : 1 }}
                              >
                                <Icon size={18} color={count > 0 ? cfg.color : "#555"} />
                                <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? cfg.color : count > 0 ? "#ccc" : "#555" }}>
                                  {cfg.label}
                                </span>
                                <span style={{ fontSize: "10px", color: "#555" }}>{cfg.time}</span>
                                <div style={{
                                  marginTop: "4px", padding: "2px 8px", borderRadius: "10px",
                                  backgroundColor: count > 0 ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)",
                                }}>
                                  <span style={{ fontSize: "11px", fontWeight: 800, color: count > 0 ? "#4ade80" : "#ef4444" }}>
                                    {count} available
                                  </span>
                                </div>
                                <span style={{ fontSize: "10px", color: "#555" }}>₹{cfg.rate}/labour</span>
                                {isSelected && <div style={{ position: "absolute", top: "8px", right: "8px", fontSize: "12px", color: cfg.color }}>✓</div>}
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      )}

                      {!date && (
                        <div style={styles.selectDateHint}>
                          👆 Select a date to see live availability per slot
                        </div>
                      )}
                    </div>

                    {/* Work Type */}
                    <div style={styles.card}>
                      <div style={styles.cardHeader}><FileText size={15} color="#4ade80" /><span style={styles.cardTitle}>Type of Work</span></div>
                      <div style={styles.workGrid}>
                        {WORK_TYPES.map(w => (
                          <motion.button key={w} type="button"
                            style={{
                              ...styles.workBtn,
                              backgroundColor: workType === w ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.02)",
                              border: `1.5px solid ${workType === w ? "#4ade80" : "rgba(255,255,255,0.07)"}`,
                              color: workType === w ? "#4ade80" : "#666",
                            }}
                            onClick={() => setWorkType(w)}
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          >{w}</motion.button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT ── */}
                  <div style={styles.col}>

                    {/* Labour Count + Cost */}
                    <div style={styles.card}>
                      <div style={styles.cardHeader}><Users size={15} color="#4ade80" /><span style={styles.cardTitle}>Labour Count & Cost</span></div>

                      {availableNow === 0 && date ? (
                        <div style={styles.noLabourWarning}>
                          <AlertCircle size={18} color="#ef4444" />
                          <div>
                            <p style={{ color: "#ef4444", fontWeight: 700, fontSize: "14px", margin: 0 }}>No Labours Available</p>
                            <p style={{ color: "#888", fontSize: "12px", margin: "2px 0 0 0" }}>Select a different date or slot</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={styles.countRow}>
                            <motion.button type="button" style={styles.countBtn}
                              onClick={() => setLabourCount(Math.max(1, labourCount - 1))}
                              whileTap={{ scale: 0.9 }}>−</motion.button>
                            <div style={styles.countDisplay}>
                              <span style={styles.countNum}>{labourCount}</span>
                              <span style={styles.countSub}>of {availableNow} available</span>
                            </div>
                            <motion.button type="button" style={styles.countBtn}
                              onClick={() => setLabourCount(Math.min(availableNow, labourCount + 1))}
                              whileTap={{ scale: 0.9 }}>+</motion.button>
                          </div>

                          {/* Availability bar */}
                          <div style={styles.availBar}>
                            <div style={{ ...styles.availBarFill, width: `${(labourCount / availableNow) * 100}%` }} />
                          </div>
                          <p style={{ textAlign: "center", fontSize: "11px", color: "#555", margin: "4px 0 14px" }}>
                            {labourCount} of {availableNow} labours selected
                          </p>
                        </>
                      )}

                      {/* Cost Breakdown */}
                      <div style={styles.costBox}>
                        <div style={styles.costRow}>
                          <span style={styles.costKey}>Labour Count</span>
                          <span style={styles.costVal}>{labourCount}</span>
                        </div>
                        <div style={styles.costRow}>
                          <span style={styles.costKey}>Rate per Labour</span>
                          <span style={styles.costVal}>₹{ratePerLabour} ({SLOT_CONFIG[slot]?.label})</span>
                        </div>
                        <div style={styles.costDivider} />
                        <div style={styles.costRow}>
                          <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>Total</span>
                          <span style={{ fontSize: "22px", fontWeight: 800, color: "#4ade80" }}>₹{totalCost.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* ── FARM LOCATION (with Live Map) ── */}
                    <div style={styles.card}>
                      <div style={styles.cardHeader}>
                        <MapPin size={15} color="#4ade80" />
                        <span style={styles.cardTitle}>Farm Location</span>
                      </div>

                      {/* GPS Button */}
                      <motion.button
                        type="button"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "11px 14px",
                          marginBottom: "12px",
                          backgroundColor: locationFetching
                            ? "rgba(74,222,128,0.04)"
                            : "rgba(74,222,128,0.1)",
                          border: "1.5px solid rgba(74,222,128,0.3)",
                          borderRadius: "9px",
                          color: "#4ade80",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: locationFetching ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                        }}
                        onClick={handleFetchLocation}
                        disabled={locationFetching}
                        whileHover={{ scale: locationFetching ? 1 : 1.02 }}
                        whileTap={{ scale: locationFetching ? 1 : 0.97 }}
                      >
                        {locationFetching ? (
                          <motion.div
                            style={{
                              width: 14,
                              height: 14,
                              border: "2px solid rgba(74,222,128,0.3)",
                              borderTop: "2px solid #4ade80",
                              borderRadius: "50%",
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                          />
                        ) : (
                          <MapPin size={14} />
                        )}
                        {locationFetching ? "Fetching your location..." : "📡 Use My Live Location"}
                      </motion.button>

                      {/* Leaflet Map — shown after GPS fetch */}
                      {mapReady && farmLat && farmLng && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            borderRadius: "10px",
                            overflow: "hidden",
                            marginBottom: "12px",
                            border: "1px solid rgba(74,222,128,0.25)",
                          }}
                        >
                          <MapContainer
                            key={`${farmLat}-${farmLng}`}
                            center={[farmLat, farmLng]}
                            zoom={15}
                            style={{ height: "210px", width: "100%" }}
                            scrollWheelZoom={false}
                          >
                            <TileLayer
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              attribution='&copy; OpenStreetMap contributors'
                            />
                            <Marker position={[farmLat, farmLng]} />
                            <MapClickHandler onLocationSelect={handleMapPinMove} />
                          </MapContainer>

                          {/* Coordinates bar under map */}
                          <div style={{
                            padding: "7px 12px",
                            backgroundColor: "rgba(74,222,128,0.06)",
                            borderTop: "1px solid rgba(74,222,128,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}>
                            <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: 600 }}>
                              🗺️ Tap map to adjust pin
                            </span>
                            <span style={{ fontSize: "10px", color: "#555" }}>
                              {farmLat?.toFixed(5)}, {farmLng?.toFixed(5)}
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Address textarea — auto-filled by GPS, editable */}
                      <textarea
                        style={{ ...styles.input, minHeight: "72px", resize: "vertical" }}
                        placeholder="Full farm address (village, taluka, district)..."
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        required
                      />

                      <input
                        style={{ ...styles.input, marginTop: "10px" }}
                        type="text"
                        placeholder="Landmark (e.g. near Shiva temple, highway junction)"
                        value={landmark}
                        onChange={e => setLandmark(e.target.value)}
                      />
                    </div>

                    {/* Notes */}
                    <div style={styles.card}>
                      <div style={styles.cardHeader}><FileText size={15} color="#4ade80" /><span style={styles.cardTitle}>Additional Notes</span></div>
                      <textarea style={{ ...styles.input, minHeight: "72px", resize: "vertical" }}
                        placeholder="Field size, tools needed, specific instructions..."
                        value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    {/* Submit */}
                    <motion.button type="submit"
                      style={{
                        ...styles.submitBtn,
                        opacity: loading || (date && availableNow === 0) ? 0.5 : 1,
                        cursor: date && availableNow === 0 ? "not-allowed" : "pointer",
                      }}
                      disabled={loading || (date && availableNow === 0)}
                      whileHover={{ scale: loading || (date && availableNow === 0) ? 1 : 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? (
                        <motion.div style={styles.spinner}
                          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
                      ) : (
                        <>{date && availableNow === 0 ? "❌ No Labours Available" : `Submit Booking · ₹${totalCost.toLocaleString()}`}</>
                      )}
                    </motion.button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}

          {/* ───── BOOKINGS TAB ───── */}
          {activeTab === "bookings" && (
            <motion.div key="bookings"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              <div style={styles.pageHeader}>
                <div>
                  <h1 style={styles.pageTitle}>My Bookings</h1>
                  <p style={styles.pageSubtitle}>{bookings.length} total bookings</p>
                </div>
                <motion.button style={styles.newBookingBtn}
                  onClick={() => setActiveTab("book")}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Plus size={14} /> New Booking
                </motion.button>
              </div>

              {bookings.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: "52px", marginBottom: "16px" }}>🌾</div>
                  <p style={{ fontSize: "20px", fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>No bookings yet!</p>
                  <p style={{ fontSize: "14px", color: "#666", margin: "0 0 24px" }}>Request your first labour booking</p>
                  <motion.button style={styles.emptyBtn} onClick={() => setActiveTab("book")}
                    whileHover={{ scale: 1.03 }}>+ Book Labour</motion.button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {bookings.map(booking => {
                    const sc = getStatusConfig(booking.status);
                    const StatusIcon = sc.icon;
                    const slotCfg = SLOT_CONFIG[booking.timeSlot];
                    const SlotIcon = slotCfg?.icon || Clock;
                    const presentCount = Object.values(booking.labourAttendance || {}).filter(Boolean).length;
                    const absentCount = (booking.assignedLabour || 0) - presentCount;

                    return (
                      <motion.div key={booking.id} style={styles.bookingCard}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2 }}>

                        {/* Header */}
                        <div style={styles.bHeader}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={styles.bDateBadge}>
                              <Calendar size={12} color="#4ade80" />
                              <span>{booking.date}</span>
                            </div>
                            <div style={{ ...styles.bStatusBadge, backgroundColor: sc.bg, color: sc.color }}>
                              <StatusIcon size={11} />
                              {sc.label}
                            </div>
                          </div>
                          <span style={styles.bCost}>
                            ₹{(booking.totalCost || (booking.labourCount * (SLOT_CONFIG[booking.timeSlot]?.rate || 300))).toLocaleString()}
                          </span>
                        </div>

                        {/* Details */}
                        <div style={styles.bDetailsGrid}>
                          <div style={styles.bDetail}>
                            <SlotIcon size={13} color={slotCfg?.color || "#888"} />
                            <span>{slotCfg?.label} · {slotCfg?.time}</span>
                          </div>
                          <div style={styles.bDetail}>
                            <Users size={13} color="#888" />
                            <span>{booking.labourCount} labours · ₹{slotCfg?.rate || 300}/each</span>
                          </div>
                          <div style={styles.bDetail}>
                            <FileText size={13} color="#888" />
                            <span>{booking.workType || "General"}</span>
                          </div>
                          <div style={styles.bDetail}>
                            <MapPin size={13} color="#888" />
                            <span>{booking.farmAddress || booking.village}</span>
                          </div>
                          {booking.landmark && (
                            <div style={styles.bDetail}>
                              <MapPin size={13} color="#555" />
                              <span style={{ color: "#666" }}>📍 {booking.landmark}</span>
                            </div>
                          )}
                          {/* Show map coords if available */}
                          {booking.farmLat && booking.farmLng && (
                            <div style={styles.bDetail}>
                              <MapPin size={13} color="#4ade80" />
                              <a
                                href={`https://www.google.com/maps?q=${booking.farmLat},${booking.farmLng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#4ade80", fontSize: "12px", textDecoration: "none", fontWeight: 600 }}
                              >
                                📍 View on Google Maps
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Supervisor Info */}
                        {booking.status === "assigned" && booking.supervisorName && (
                          <div style={styles.supervisorBox}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                              <User size={13} color="#60a5fa" />
                              <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                Assigned Supervisor
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={styles.supAvatar}>{booking.supervisorName[0]}</div>
                              <div>
                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{booking.supervisorName}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                                  <Phone size={11} color="#60a5fa" />
                                  <span style={{ fontSize: "12px", color: "#60a5fa" }}>{booking.supervisorPhone}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Assigned Labours + Attendance */}
                        {booking.status === "assigned" && booking.assignedLabourNames?.length > 0 && (
                          <div style={styles.laboursBox}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                              <Users size={13} color="#a78bfa" />
                              <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                Assigned Labours ({booking.assignedLabour})
                              </span>
                              <span style={{ marginLeft: "auto", color: "#555", fontSize: "11px" }}>Tap name to mark attendance</span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {booking.assignedLabourNames.map((name, idx) => {
                                const labourId = booking.assignedLabourIds?.[idx];
                                const isPresent = booking.labourAttendance?.[labourId] === true;
                                return (
                                  <motion.div key={idx}
                                    style={{
                                      ...styles.labourRow,
                                      backgroundColor: isPresent ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.02)",
                                      border: `1px solid ${isPresent ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"}`,
                                    }}
                                    whileHover={{ scale: 1.01 }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <div style={{
                                        width: "8px", height: "8px", borderRadius: "50%",
                                        backgroundColor: isPresent ? "#4ade80" : "#333",
                                      }} />
                                      <span style={{ fontSize: "13px", color: isPresent ? "#e2e8f0" : "#777", fontWeight: isPresent ? 600 : 400 }}>
                                        👤 {name}
                                      </span>
                                    </div>
                                    <motion.button
                                      style={{
                                        ...styles.attBtn,
                                        backgroundColor: isPresent ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
                                        color: isPresent ? "#4ade80" : "#555",
                                        border: `1px solid ${isPresent ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`,
                                      }}
                                      onClick={() => handleMarkAttendance(booking.id, labourId, isPresent)}
                                      whileTap={{ scale: 0.93 }}
                                    >
                                      {isPresent ? "✅ Present" : "Mark Present"}
                                    </motion.button>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {/* Summary */}
                            <div style={styles.attSummary}>
                              <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: 600 }}>✅ {presentCount} present</span>
                              <span style={{ color: absentCount > 0 ? "#ef4444" : "#555", fontSize: "12px", fontWeight: 600 }}>❌ {absentCount} absent</span>
                            </div>
                          </div>
                        )}

                        {/* Confirm Work */}
                        {booking.status === "assigned" && !booking.farmerConfirmed && (
                          <motion.button style={styles.confirmBtn}
                            onClick={() => handleConfirmBooking(booking.id)}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                            <CheckCircle2 size={15} />
                            Confirm Work Completed
                          </motion.button>
                        )}

                        {booking.farmerConfirmed && (
                          <div style={styles.confirmedRow}>
                            <CheckCircle2 size={13} color="#4ade80" />
                            <span>You confirmed work completion</span>
                            {!booking.supervisorConfirmed && (
                              <span style={{ color: "#f59e0b", fontSize: "11px" }}>· Waiting for supervisor</span>
                            )}
                            {booking.supervisorConfirmed && (
                              <span style={{ color: "#4ade80", fontSize: "11px" }}>· Supervisor also confirmed ✅</span>
                            )}
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
  );
}

const styles = {
  root: { minHeight: "100vh", backgroundColor: "#060d08", display: "flex", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e2e8f0" },
  sidebar: { width: "260px", minHeight: "100vh", backgroundColor: "#0a1410", borderRight: "1px solid rgba(74,222,128,0.08)", padding: "24px 0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0 },
  sidebarLogo: { display: "flex", alignItems: "center", gap: "10px", padding: "0 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  logoIcon: { width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center" },
  logoTitle: { fontSize: "15px", fontWeight: 800, color: "#fff" },
  logoSub: { fontSize: "10px", color: "#4ade80", fontWeight: 500 },
  farmerCard: { margin: "16px 12px", padding: "14px", backgroundColor: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px" },
  farmerAvatar: { width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "rgba(74,222,128,0.15)", border: "2px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 800, color: "#4ade80", flexShrink: 0 },
  farmerName: { fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "2px" },
  farmerMeta: { fontSize: "11px", color: "#555" },
  nav: { padding: "16px 12px", flex: 1 },
  navItem: { width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "none", cursor: "pointer", marginBottom: "4px", transition: "all 0.2s" },
  navLabel: { fontSize: "13px", fontWeight: 600, flex: 1, textAlign: "left" },
  navBadge: { backgroundColor: "rgba(74,222,128,0.12)", color: "#4ade80", fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px" },
  liveBox: { margin: "0 12px 12px", padding: "14px", backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px" },
  liveDot: { width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 8px #4ade80", flexShrink: 0, animation: "pulse 1.5s infinite" },
  liveNum: { fontSize: "22px", fontWeight: 800, color: "#4ade80", lineHeight: 1 },
  liveLabel: { fontSize: "11px", color: "#666", marginTop: "2px" },
  slotPreviewBox: { margin: "0 12px 12px", padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" },
  slotPreviewTitle: { fontSize: "11px", fontWeight: 700, color: "#4ade80", margin: "0 0 8px 0" },
  slotPreviewRow: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" },
  logoutBtn: { margin: "0 12px", padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  main: { flex: 1, padding: "32px", overflowY: "auto", minHeight: "100vh" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  pageTitle: { fontSize: "24px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" },
  pageSubtitle: { fontSize: "13px", color: "#555", margin: "4px 0 0" },
  rateTag: { display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)", padding: "8px 14px", borderRadius: "20px", fontSize: "12px", color: "#4ade80", fontWeight: 600 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" },
  col: { display: "flex", flexDirection: "column", gap: "14px" },
  card: { backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "18px" },
  cardHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" },
  cardTitle: { fontSize: "12px", fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" },
  input: { width: "100%", padding: "11px 13px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "9px", fontSize: "14px", color: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  availGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginTop: "12px" },
  availSlotCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "12px 6px", borderRadius: "10px", cursor: "pointer", border: "none", fontFamily: "inherit", position: "relative", transition: "all 0.2s" },
  selectDateHint: { marginTop: "12px", padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", fontSize: "12px", color: "#555", textAlign: "center" },
  workGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" },
  workBtn: { padding: "9px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "inherit", transition: "all 0.2s" },
  noLabourWarning: { display: "flex", alignItems: "center", gap: "12px", padding: "14px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", marginBottom: "12px" },
  countRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", marginBottom: "12px" },
  countBtn: { width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "rgba(74,222,128,0.08)", border: "1.5px solid rgba(74,222,128,0.25)", color: "#4ade80", fontSize: "20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  countDisplay: { display: "flex", flexDirection: "column", alignItems: "center" },
  countNum: { fontSize: "38px", fontWeight: 800, color: "#fff", lineHeight: 1 },
  countSub: { fontSize: "11px", color: "#555", marginTop: "2px" },
  availBar: { height: "4px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", marginBottom: "4px" },
  availBarFill: { height: "100%", backgroundColor: "#4ade80", borderRadius: "2px", transition: "width 0.3s" },
  costBox: { backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "14px" },
  costRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" },
  costKey: { fontSize: "12px", color: "#555" },
  costVal: { fontSize: "12px", color: "#999", fontWeight: 600 },
  costDivider: { height: "1px", backgroundColor: "rgba(255,255,255,0.05)", margin: "8px 0" },
  submitBtn: { width: "100%", padding: "14px", background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 800, color: "#060d08", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontFamily: "inherit" },
  spinner: { width: "18px", height: "18px", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid #060d08", borderRadius: "50%" },
  newBookingBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", backgroundColor: "rgba(74,222,128,0.1)", border: "1.5px solid rgba(74,222,128,0.25)", borderRadius: "8px", color: "#4ade80", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  emptyState: { textAlign: "center", padding: "80px 40px", backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px" },
  emptyBtn: { padding: "12px 24px", background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: "10px", color: "#060d08", fontSize: "14px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" },
  bookingCard: { backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px", transition: "all 0.2s" },
  bHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  bDateBadge: { display: "flex", alignItems: "center", gap: "5px", backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", color: "#4ade80", fontWeight: 600 },
  bStatusBadge: { display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" },
  bCost: { fontSize: "17px", fontWeight: 800, color: "#fff" },
  bDetailsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" },
  bDetail: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#777" },
  supervisorBox: { backgroundColor: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: "10px", padding: "12px", marginBottom: "10px" },
  supAvatar: { width: "34px", height: "34px", borderRadius: "50%", backgroundColor: "rgba(96,165,250,0.12)", border: "1.5px solid rgba(96,165,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#60a5fa" },
  laboursBox: { backgroundColor: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: "10px", padding: "12px", marginBottom: "10px" },
  labourRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 11px", borderRadius: "8px" },
  attBtn: { padding: "5px 11px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: "none", fontFamily: "inherit" },
  attSummary: { display: "flex", gap: "16px", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.04)" },
  confirmBtn: { width: "100%", padding: "11px", backgroundColor: "rgba(74,222,128,0.08)", border: "1.5px solid rgba(74,222,128,0.25)", borderRadius: "10px", color: "#4ade80", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontFamily: "inherit", marginTop: "4px" },
  confirmedRow: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", marginTop: "4px", backgroundColor: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: "8px", fontSize: "12px", color: "#4ade80", fontWeight: 600 },
};