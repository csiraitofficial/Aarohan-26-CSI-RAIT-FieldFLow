import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { auth, db } from "../../firebase";
import {
  collection, addDoc, query, where, doc,
  getDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Leaf, LogOut, Plus, Calendar, Clock, Users,
  MapPin, FileText, CheckCircle2, AlertCircle,
  Phone, User, Wallet, Sun, Sunset, Sunrise,
  ClipboardList, Menu, X, Activity,
} from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SLOT_CONFIG = {
  "8-12":  { label:"Morning",   time:"8:00 AM – 12:00 PM", icon:Sunrise, color:"#b45309", bg:"#fef9f0", border:"#fde68a", rate:300 },
  "2-6":   { label:"Afternoon", time:"2:00 PM – 6:00 PM",  icon:Sunset,  color:"#c2410c", bg:"#fff7f0", border:"#fed7aa", rate:300 },
  fullday: { label:"Full Day",  time:"8:00 AM – 6:00 PM",  icon:Sun,     color:"#2d6a4f", bg:"#f0fdf4", border:"#bbf7d0", rate:600 },
};

const WORK_TYPES = ["Harvesting","Planting","Weeding","Irrigation","Spraying","Tilling","Loading","Other"];

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({ click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function FarmerDashboard() {
  const [farmerData,    setFarmerData]    = useState(null);
  const [bookings,      setBookings]      = useState([]);
  const [allLabours,    setAllLabours]    = useState([]);
  const [allBookings,   setAllBookings]   = useState([]);
  const [activeTab,     setActiveTab]     = useState("book");
  const [bookingSubTab, setBookingSubTab] = useState("live");
  const [loading,       setLoading]       = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [authChecked,   setAuthChecked]   = useState(false);

  // Form
  const [date,        setDate]        = useState("");
  const [slot,        setSlot]        = useState("8-12");
  const [workType,    setWorkType]    = useState("Harvesting");
  const [labourCount, setLabourCount] = useState(1);
  const [address,     setAddress]     = useState("");
  const [landmark,    setLandmark]    = useState("");
  const [description, setDescription] = useState("");

  // Map
  const [farmLat,          setFarmLat]          = useState(null);
  const [farmLng,          setFarmLng]          = useState(null);
  const [locationFetching, setLocationFetching] = useState(false);
  const [mapReady,         setMapReady]         = useState(false);

  const navigate = useNavigate();

  // ── AUTH PERSISTENCE FIX ──
  // onAuthStateChanged waits for Firebase to rehydrate the session from
  // IndexedDB/localStorage before deciding whether to redirect. The old
  // auth.currentUser check fires before rehydration, so it's always null
  // on a fresh page load → immediate logout.
  useEffect(() => {
    let unsubB1, unsubB2, unsubL;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);
      if (!user) { navigate("/login"); return; }

      getDoc(doc(db, "users", user.uid)).then(d => {
        if (d.exists()) setFarmerData(d.data());
      });

      const bq = query(collection(db, "bookings"), where("farmerId", "==", user.uid));
      unsubB1 = onSnapshot(bq, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a,b) => new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0));
        setBookings(list);
      });
      unsubB2 = onSnapshot(collection(db,"bookings"), snap => setAllBookings(snap.docs.map(d=>({id:d.id,...d.data()}))));
      unsubL  = onSnapshot(collection(db,"labours"),  snap => setAllLabours(snap.docs.map(d=>({id:d.id,...d.data()}))));
    });

    return () => {
      unsubAuth();
      unsubB1?.();
      unsubB2?.();
      unsubL?.();
    };
  }, [navigate]);

  // Show nothing while Firebase checks auth (prevents flash-redirect)
  if (!authChecked) return null;

  const liveBookings        = bookings.filter(b => b.status === "assigned" && !(b.farmerConfirmed && b.supervisorConfirmed));
  const completedBookings   = bookings.filter(b => b.status === "completed" || (b.farmerConfirmed && b.supervisorConfirmed));
  const unassignedBookings  = bookings.filter(b => b.status === "pending" && !b.assignedLabourIds?.length);

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
          toast.success("📍 Location fetched!");
        } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); toast.success("Location pinned!"); }
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
      toast.success("Pin moved!");
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
      await addDoc(collection(db,"bookings"), {
        farmerId:user.uid, farmerName:farmerData?.name, farmerPhone:farmerData?.phone,
        village:farmerData?.village, farmAddress:address, landmark,
        farmLat, farmLng, labourCount, timeSlot:slot, workType, date, description,
        totalCost, ratePerLabour, status:"pending",
        supervisorId:null, supervisorName:null, supervisorPhone:null,
        assignedLabour:0, assignedLabourIds:[], assignedLabourNames:[],
        farmerConfirmed:false, supervisorConfirmed:false,
        farmerAttendance:{},
        labourAttendance:{},
        createdAt:new Date(),
      });
      toast.success("Booking submitted! 🌾");
      setDate(""); setAddress(""); setLandmark(""); setDescription("");
      setLabourCount(1); setSlot("8-12"); setFarmLat(null); setFarmLng(null); setMapReady(false);
      setActiveTab("bookings"); setBookingSubTab("unassigned");
    } catch { toast.error("Failed to submit. Try again!"); }
    setLoading(false);
  };

  const handleMarkAttendance = async (bookingId, labourId, currentStatus) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      const updated = { ...(booking.farmerAttendance || {}), [labourId]: !currentStatus };
      await updateDoc(doc(db,"bookings",bookingId), { farmerAttendance: updated });
      toast.success(!currentStatus ? "Marked present ✅" : "Marked absent");
    } catch { toast.error("Failed to update."); }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await updateDoc(doc(db,"bookings",bookingId), { farmerConfirmed: true });
      toast.success("Work confirmed!");
    } catch { toast.error("Failed to confirm."); }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  const getStatusConfig = (status) => {
    if (status==="pending")   return { color:"#92400e", bg:"#fef9f0", border:"#fde68a", label:"Pending",   icon:AlertCircle };
    if (status==="assigned")  return { color:"#14532d", bg:"#f0fdf4", border:"#bbf7d0", label:"Assigned",  icon:CheckCircle2 };
    if (status==="completed") return { color:"#3730a3", bg:"#f5f3ff", border:"#c4b5fd", label:"Completed", icon:CheckCircle2 };
    return { color:"#374151", bg:"#f9fafb", border:"#e5e7eb", label:status, icon:AlertCircle };
  };

  const totalAvailableLabours = allLabours.filter(l => l.available === true).length;

  // ── BOOKING CARD ──
  const renderBookingCard = (booking) => {
    const sc         = getStatusConfig(booking.status);
    const StatusIcon = sc.icon;
    const slotCfg    = SLOT_CONFIG[booking.timeSlot];
    const SlotIcon   = slotCfg?.icon || Clock;
    const farmerAtt    = booking.farmerAttendance  || {};
    const presentCount = Object.values(farmerAtt).filter(Boolean).length;
    const absentCount  = (booking.assignedLabour || 0) - presentCount;

    return (
      <motion.div key={booking.id}
        style={s.bookingCard}
        initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
        whileHover={{ y:-3, boxShadow:"0 12px 32px rgba(27,67,50,0.12)" }}
        transition={{ duration:0.2 }}>

        {/* Card top bar */}
        <div style={s.cardTopBar}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <div style={s.dateBadge}>
              <Calendar size={11} color="#2d6a4f" strokeWidth={2.5}/>
              <span>{booking.date}</span>
            </div>
            <div style={{ ...s.statusBadge, color:sc.color, background:sc.bg, border:`1px solid ${sc.border}` }}>
              <StatusIcon size={10} strokeWidth={2.5}/>
              <span>{sc.label}</span>
            </div>
            {booking.status==="assigned" && booking.assignedLabour < booking.labourCount && (
              <div style={s.partialBadge}>
                ⚡ {booking.assignedLabour}/{booking.labourCount} filled
              </div>
            )}
          </div>
          <span style={s.costTag}>₹{(booking.totalCost || (booking.labourCount*(SLOT_CONFIG[booking.timeSlot]?.rate||300))).toLocaleString()}</span>
        </div>

        {/* Divider */}
        <div style={s.cardDivider}/>

        {/* Details */}
        <div style={s.detailsGrid}>
          <div style={s.detailItem}><SlotIcon size={13} color={slotCfg?.color||"#9ca3af"} strokeWidth={2}/><span>{slotCfg?.label} · {slotCfg?.time}</span></div>
          <div style={s.detailItem}><Users size={13} color="#9ca3af" strokeWidth={2}/><span>{booking.labourCount} needed · {booking.assignedLabour||0} assigned</span></div>
          <div style={s.detailItem}><FileText size={13} color="#9ca3af" strokeWidth={2}/><span>{booking.workType||"General"}</span></div>
          <div style={{...s.detailItem,overflow:"hidden"}}><MapPin size={13} color="#9ca3af" strokeWidth={2} style={{flexShrink:0}}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{booking.farmAddress||booking.village}</span></div>
          {booking.landmark && <div style={s.detailItem}><MapPin size={12} color="#d1d5db" strokeWidth={2}/><span style={{color:"#9ca3af"}}>{booking.landmark}</span></div>}
          {booking.farmLat && booking.farmLng && (
            <div style={s.detailItem}>
              <MapPin size={13} color="#2563eb" strokeWidth={2}/>
              <a href={`https://www.google.com/maps?q=${booking.farmLat},${booking.farmLng}`} target="_blank" rel="noopener noreferrer"
                style={{ color:"#2d6a4f", fontSize:12, fontWeight:600, textDecoration:"none" }}>View on Maps ↗</a>
            </div>
          )}
        </div>

        {/* Supervisor block */}
        {booking.status==="assigned" && booking.supervisorName && (
          <div style={s.supervisorBlock}>
            <p style={s.supervisorLabel}><User size={11} color="#2563eb" strokeWidth={2.5}/> Assigned Supervisor</p>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:8 }}>
              <div style={s.supervisorAvatar}>{booking.supervisorName[0]}</div>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:"#1e3a5f", margin:0 }}>{booking.supervisorName}</p>
                <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
                  <Phone size={10} color="#2563eb" strokeWidth={2}/>
                  <span style={{ fontSize:12, color:"#2563eb", fontWeight:500 }}>{booking.supervisorPhone}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance */}
        {booking.status==="assigned" && booking.assignedLabourNames?.length > 0 && (
          <div style={s.attendanceBlock}>
            <div style={s.attendanceHeader}>
              <Users size={12} color="#2d6a4f" strokeWidth={2.5}/>
              <span>Assigned Labours ({booking.assignedLabour}) — Your Attendance</span>
            </div>
            <div style={s.attendanceNote}>
              Your attendance record is independent from the supervisor's. Both are reviewed by admin.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:10 }}>
              {booking.assignedLabourNames.map((name, idx) => {
                const labourId  = booking.assignedLabourIds?.[idx];
                const isPresent = farmerAtt[labourId] === true;
                return (
                  <div key={idx} style={{ ...s.labourRow, background:isPresent?"#f0fdf4":"#fafcfb", borderColor:isPresent?"#bbf7d0":"#e8f5e9" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:isPresent?"#16a34a":"#d1d5db", flexShrink:0 }}/>
                      <span style={{ fontSize:13, color:isPresent?"#14532d":"#6b7280", fontWeight:isPresent?600:400 }}>{name}</span>
                    </div>
                    <motion.button
                      style={{ ...s.attendBtn, background:isPresent?"#dcfce7":"#f3f4f6", color:isPresent?"#15803d":"#9ca3af" }}
                      onClick={() => handleMarkAttendance(booking.id, labourId, isPresent)}
                      whileTap={{ scale:0.93 }}>
                      {isPresent ? "✓ Present" : "Mark Present"}
                    </motion.button>
                  </div>
                );
              })}
            </div>
            <div style={s.attendanceSummary}>
              <span style={{ color:"#16a34a", fontSize:12, fontWeight:600 }}>✓ {presentCount} present</span>
              <span style={{ color:absentCount>0?"#dc2626":"#9ca3af", fontSize:12, fontWeight:600 }}>✗ {absentCount} absent</span>
            </div>
          </div>
        )}

        {/* Confirm button */}
        {booking.status==="assigned" && !booking.farmerConfirmed && (
          <motion.button style={s.confirmBtn}
            onClick={() => handleConfirmBooking(booking.id)}
            whileHover={{ background:"#dcfce7" }} whileTap={{ scale:0.97 }}>
            <CheckCircle2 size={14} strokeWidth={2.5}/> Confirm Work Completed
          </motion.button>
        )}

        {booking.farmerConfirmed && (
          <div style={s.confirmedBar}>
            <CheckCircle2 size={13} color="#16a34a" strokeWidth={2.5}/>
            <span>You confirmed work completion</span>
            {!booking.supervisorConfirmed && <span style={{ color:"#92400e", fontSize:11, marginLeft:4 }}>· Awaiting supervisor</span>}
            {booking.supervisorConfirmed  && <span style={{ color:"#16a34a", fontSize:11, marginLeft:4 }}>· Supervisor confirmed ✓</span>}
          </div>
        )}
      </motion.div>
    );
  };

  // ── SIDEBAR ──
  const SidebarNav = ({ onNavigate }) => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"0 0 20px" }}>

      {/* Brand */}
      <div style={s.sidebarBrand}>
        <div style={s.sidebarLogoMark}>
          <Leaf size={18} color="#fff" strokeWidth={2.5}/>
        </div>
        <div>
          <div style={s.sidebarBrandName}>KrishiSetu</div>
          <div style={s.sidebarBrandSub}>Farmer Portal</div>
        </div>
      </div>

      {/* Profile */}
      {farmerData && (
        <div style={s.profileCard}>
          <div style={s.profileAvatar}>{farmerData.name?.[0]?.toUpperCase()}</div>
          <div style={{ minWidth:0 }}>
            <div style={s.profileName}>{farmerData.name}</div>
            <div style={s.profileMeta}><Phone size={9} color="#8aab97" strokeWidth={2}/>{farmerData.phone}</div>
            <div style={s.profileMeta}><MapPin size={9} color="#8aab97" strokeWidth={2}/>{farmerData.village}</div>
          </div>
        </div>
      )}

      {/* Section label */}
      <div style={s.navSectionLabel}>Navigation</div>

      {/* Nav items */}
      <nav style={{ padding:"0 10px", flex:1 }}>
        {[
          { id:"book",     icon:Plus,          label:"Book Labour",  badge:null },
          { id:"bookings", icon:ClipboardList,  label:"My Bookings", badge:bookings.length },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button key={item.id} style={{ ...s.navBtn, background:isActive?"#f4fdf6":"transparent", borderLeftColor:isActive?"#2d6a4f":"transparent" }}
              onClick={() => { setActiveTab(item.id); onNavigate?.(); }}
              whileHover={{ x:3 }} whileTap={{ scale:0.97 }}>
              <Icon size={16} color={isActive?"#2d6a4f":"#a0bcaf"} strokeWidth={isActive?2.5:2}/>
              <span style={{ ...s.navBtnLabel, color:isActive?"#1b4332":"#6b7280" }}>{item.label}</span>
              {item.badge>0 && (
                <span style={{ ...s.navBadge, background:isActive?"#2d6a4f":"#e8f5e9", color:isActive?"#fff":"#6b7280" }}>{item.badge}</span>
              )}
            </motion.button>
          );
        })}

        <AnimatePresence>
          {activeTab==="bookings" && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
              style={{ overflow:"hidden", marginLeft:8, paddingLeft:12, borderLeft:"2px solid #d8f3dc", marginTop:2 }}>
              {[
                { id:"live",       icon:Activity,     label:"Live Work",      count:liveBookings.length,       activeColor:"#2d6a4f", activeBg:"#f0fdf4" },
                { id:"completed",  icon:CheckCircle2, label:"Completed",      count:completedBookings.length,  activeColor:"#4f46e5", activeBg:"#f5f3ff" },
                { id:"unassigned", icon:AlertCircle,  label:"Unassigned",     count:unassignedBookings.length, activeColor:"#92400e", activeBg:"#fef9f0" },
              ].map(sub => {
                const Icon = sub.icon;
                const isActive = bookingSubTab === sub.id;
                return (
                  <motion.button key={sub.id}
                    style={{ ...s.subNavBtn, background:isActive?sub.activeBg:"transparent", color:isActive?sub.activeColor:"#9ca3af" }}
                    onClick={() => { setBookingSubTab(sub.id); onNavigate?.(); }}
                    whileHover={{ x:2 }} whileTap={{ scale:0.97 }}>
                    <Icon size={13} strokeWidth={isActive?2.5:2}/>
                    <span style={{ fontSize:12, fontWeight:600, flex:1, textAlign:"left" }}>{sub.label}</span>
                    <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:20, background:isActive?`${sub.activeColor}15`:"#f3f4f6", color:isActive?sub.activeColor:"#9ca3af" }}>{sub.count}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Stats */}
      <div style={s.sidebarStats}>
        {[
          { val: bookings.length, label:"Total" },
          { val: liveBookings.length, label:"Active" },
          { val: unassignedBookings.length, label:"Pending" },
        ].map((s2, i) => (
          <div key={s2.label} style={{ textAlign:"center", flex:1, borderRight: i<2 ? "1px solid #e8f5e9" : "none" }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#1b4332", lineHeight:1 }}>{s2.val}</div>
            <div style={{ fontSize:9, color:"#9ca3af", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginTop:3 }}>{s2.label}</div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <motion.button style={s.logoutBtn} onClick={handleLogout} whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
        <LogOut size={15} color="#dc2626" strokeWidth={2}/>
        <span style={{ color:"#dc2626", fontSize:13, fontWeight:600 }}>Sign Out</span>
      </motion.button>
    </div>
  );

  const EmptyState = ({ icon, title, subtitle, action, onAction }) => (
    <motion.div style={s.emptyState} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
      <div style={{ fontSize:44, marginBottom:16 }}>{icon}</div>
      <p style={{ fontSize:18, fontWeight:800, color:"#1b4332", marginBottom:8 }}>{title}</p>
      <p style={{ fontSize:13, color:"#9ca3af", marginBottom:action?24:0, lineHeight:1.6 }}>{subtitle}</p>
      {action && (
        <motion.button style={s.emptyActionBtn} onClick={onAction} whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>{action}</motion.button>
      )}
    </motion.div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:#f4fdf6; font-family:'Poppins','Segoe UI',sans-serif; }

        .fd-root      { min-height:100vh; display:flex; background:#f7faf8; font-family:'Poppins','Segoe UI',sans-serif; color:#1a1a1a; }
        .fd-sidebar   { width:252px; min-height:100vh; background:#fff; border-right:1px solid #e4ede8; display:flex; flex-direction:column; position:sticky; top:0; height:100vh; overflow-y:auto; flex-shrink:0; box-shadow:1px 0 12px rgba(27,67,50,0.05); }
        .fd-main-wrap { flex:1; display:flex; flex-direction:column; min-width:0; }
        .fd-topbar    { display:none; }
        .fd-main      { flex:1; padding:32px 36px; overflow-y:auto; }
        .fd-overlay   { display:none; }
        .fd-drawer    { display:none; }

        .fd-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .fd-avail-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
        .fd-work-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }

        @media (max-width:960px){
          .fd-sidebar  { display:none; }
          .fd-topbar   { display:flex; position:sticky; top:0; z-index:30; background:#fff; border-bottom:1px solid #e4ede8; padding:12px 18px; align-items:center; justify-content:space-between; box-shadow:0 1px 10px rgba(27,67,50,0.07); }
          .fd-main     { padding:18px; }
          .fd-overlay  { display:block; position:fixed; inset:0; background:rgba(0,0,0,0.25); z-index:40; backdrop-filter:blur(2px); }
          .fd-drawer   { display:flex; flex-direction:column; position:fixed; left:0; top:0; height:100vh; width:260px; background:#fff; z-index:50; overflow-y:auto; box-shadow:4px 0 32px rgba(27,67,50,0.14); }
        }
        @media (max-width:720px) { .fd-form-grid { grid-template-columns:1fr; } }
        @media (max-width:480px) { .fd-avail-grid { grid-template-columns:1fr; } }

        input:focus, textarea:focus, select:focus {
          outline:none !important;
          border-color:#52b788 !important;
          box-shadow:0 0 0 3px rgba(82,183,136,0.15) !important;
        }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor:pointer; opacity:0.5; }
        textarea { font-family:'Poppins','Segoe UI',sans-serif; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#d8f3dc; border-radius:10px; }
      `}</style>

      <div className="fd-root">
        <Toaster position="top-center" toastOptions={{
          style:{ fontFamily:"'Poppins','Segoe UI',sans-serif", fontSize:"13px", borderRadius:"10px", border:"1px solid #e4ede8", boxShadow:"0 4px 20px rgba(27,67,50,0.10)" }
        }}/>

        {/* Desktop sidebar */}
        <aside className="fd-sidebar"><SidebarNav/></aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div className="fd-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setSidebarOpen(false)}/>
              <motion.div className="fd-drawer" initial={{ x:-260 }} animate={{ x:0 }} exit={{ x:-260 }} transition={{ type:"tween", duration:0.2 }}>
                <button onClick={() => setSidebarOpen(false)}
                  style={{ position:"absolute", top:14, right:14, background:"#f4fdf6", border:"1px solid #e4ede8", cursor:"pointer", padding:6, borderRadius:8, color:"#9ca3af", zIndex:1, display:"flex" }}>
                  <X size={16}/>
                </button>
                <SidebarNav onNavigate={() => setSidebarOpen(false)}/>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="fd-main-wrap">

          {/* Mobile topbar */}
          <div className="fd-topbar">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={s.sidebarLogoMark}><Leaf size={15} color="#fff" strokeWidth={2.5}/></div>
              <span style={{ fontWeight:800, fontSize:16, color:"#1b4332", letterSpacing:"-0.3px" }}>KrishiSetu</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={s.availPill}>🟢 {totalAvailableLabours} available</div>
              <button onClick={() => setSidebarOpen(true)} style={{ background:"#f4fdf6", border:"1px solid #e4ede8", cursor:"pointer", padding:"7px 8px", borderRadius:8, color:"#374151", display:"flex" }}>
                <Menu size={20}/>
              </button>
            </div>
          </div>

          <main className="fd-main">
            <AnimatePresence mode="wait">

              {/* ══ BOOK TAB ══ */}
              {activeTab==="book" && (
                <motion.div key="book" initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-18 }} transition={{ duration:0.25 }}>

                  <div style={s.pageHeader}>
                    <div>
                      <h1 style={s.pageTitle}>Book Labour</h1>
                      <p style={s.pageSubtitle}>Request agricultural workers for your farm</p>
                    </div>
                    <div style={s.ratePill}>
                      <Wallet size={13} color="#2d6a4f" strokeWidth={2}/>
                      <span>₹300 / slot &nbsp;·&nbsp; ₹600 / full day</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div className="fd-form-grid">

                      {/* ─ LEFT COLUMN ─ */}
                      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

                        {/* Date & Slots */}
                        <div style={s.formCard}>
                          <div style={s.formCardHeader}>
                            <div style={{ ...s.formCardIcon, background:"#f0fdf4" }}><Calendar size={14} color="#2d6a4f" strokeWidth={2.5}/></div>
                            <span style={s.formCardTitle}>Date & Availability</span>
                          </div>
                          <input style={s.input} type="date" value={date}
                            onChange={e => { setDate(e.target.value); setLabourCount(1); }}
                            min={new Date().toISOString().split("T")[0]} required/>

                          {date ? (
                            <motion.div className="fd-avail-grid" initial={{ opacity:0 }} animate={{ opacity:1 }}>
                              {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
                                const Icon = cfg.icon;
                                const count = getAvailableCount(date, key);
                                const isSel = slot === key;
                                return (
                                  <motion.button key={key} type="button"
                                    style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"13px 6px", borderRadius:12, cursor:count===0?"not-allowed":"pointer",
                                      border:`1.5px solid ${isSel?cfg.color:count>0?"#e8f5e9":"#fca5a5"}`,
                                      background:isSel?cfg.bg:count>0?"#fff":"#fff8f8",
                                      opacity:count===0?0.55:1, position:"relative", fontFamily:"inherit",
                                      boxShadow:isSel?`0 0 0 3px ${cfg.color}20,0 2px 8px rgba(0,0,0,0.04)`:"0 1px 4px rgba(0,0,0,0.03)",
                                      transition:"all 0.15s" }}
                                    onClick={() => { if(count>0){setSlot(key);setLabourCount(1);}else toast.error("No labours for this slot!"); }}
                                    whileHover={{ scale:count>0?1.03:1, y:count>0?-1:0 }} whileTap={{ scale:count>0?0.97:1 }}>
                                    <Icon size={18} color={count>0?cfg.color:"#d1d5db"} strokeWidth={2}/>
                                    <span style={{ fontSize:11, fontWeight:700, color:isSel?cfg.color:count>0?"#374151":"#9ca3af", marginTop:2 }}>{cfg.label}</span>
                                    <span style={{ fontSize:9, color:"#9ca3af", textAlign:"center", lineHeight:1.3 }}>{cfg.time}</span>
                                    <div style={{ marginTop:4, padding:"2px 8px", borderRadius:20, background:count>0?"#f0fdf4":"#fee2e2" }}>
                                      <span style={{ fontSize:10, fontWeight:800, color:count>0?"#2d6a4f":"#dc2626" }}>{count} avail.</span>
                                    </div>
                                    <span style={{ fontSize:9, color:"#9ca3af" }}>₹{cfg.rate}/ea</span>
                                    {isSel && <div style={{ position:"absolute", top:7, right:8, fontSize:10, color:cfg.color, fontWeight:900 }}>✓</div>}
                                  </motion.button>
                                );
                              })}
                            </motion.div>
                          ) : (
                            <div style={s.emptySlotHint}>Select a date to see live slot availability</div>
                          )}
                        </div>

                        {/* Work Type */}
                        <div style={s.formCard}>
                          <div style={s.formCardHeader}>
                            <div style={{ ...s.formCardIcon, background:"#fef9f0" }}><FileText size={14} color="#b45309" strokeWidth={2.5}/></div>
                            <span style={s.formCardTitle}>Type of Work</span>
                          </div>
                          <div className="fd-work-grid">
                            {WORK_TYPES.map(w => (
                              <motion.button key={w} type="button"
                                style={{ padding:"9px 10px", borderRadius:9, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                                  background:workType===w?"#f4fdf6":"#fafcfb",
                                  border:`1.5px solid ${workType===w?"#52b788":"#e4ede8"}`,
                                  color:workType===w?"#1b4332":"#6b7280",
                                  transition:"all 0.15s" }}
                                onClick={() => setWorkType(w)} whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
                                {w}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Farm Location */}
                        <div style={s.formCard}>
                          <div style={s.formCardHeader}>
                            <div style={{ ...s.formCardIcon, background:"#eff6ff" }}><MapPin size={14} color="#2563eb" strokeWidth={2.5}/></div>
                            <span style={s.formCardTitle}>Farm Location</span>
                          </div>

                          <motion.button type="button"
                            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"11px 14px", marginBottom:14, background:"#f4fdf6", border:"1.5px solid #52b788", borderRadius:10, color:"#1b4332", fontSize:13, fontWeight:600, cursor:locationFetching?"not-allowed":"pointer", fontFamily:"inherit" }}
                            onClick={handleFetchLocation} disabled={locationFetching}
                            whileHover={{ scale:locationFetching?1:1.01 }} whileTap={{ scale:locationFetching?1:0.98 }}>
                            {locationFetching
                              ? <motion.div style={{ width:14, height:14, border:"2px solid #b7e4c7", borderTop:"2px solid #2d6a4f", borderRadius:"50%" }} animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:0.8, ease:"linear" }}/>
                              : <MapPin size={14} color="#2d6a4f" strokeWidth={2.5}/>}
                            {locationFetching ? "Fetching location…" : "Use My Live Location"}
                          </motion.button>

                          {mapReady && farmLat && farmLng && (
                            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                              style={{ borderRadius:12, overflow:"hidden", marginBottom:14, border:"1.5px solid #52b788", boxShadow:"0 2px 12px rgba(27,67,50,0.08)" }}>
                              <MapContainer key={`${farmLat}-${farmLng}`} center={[farmLat,farmLng]} zoom={15} style={{ height:200, width:"100%" }} scrollWheelZoom={false}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"/>
                                <Marker position={[farmLat,farmLng]}/>
                                <MapClickHandler onLocationSelect={handleMapPinMove}/>
                              </MapContainer>
                              <div style={{ padding:"7px 12px", background:"#f4fdf6", borderTop:"1px solid #d8f3dc", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <span style={{ fontSize:11, color:"#2d6a4f", fontWeight:600 }}>Tap map to move pin</span>
                                <span style={{ fontSize:10, color:"#9ca3af" }}>{farmLat?.toFixed(5)}, {farmLng?.toFixed(5)}</span>
                              </div>
                            </motion.div>
                          )}

                          <textarea style={{ ...s.input, minHeight:74, resize:"vertical" }}
                            placeholder="Full farm address (village, taluka, district)…"
                            value={address} onChange={e => setAddress(e.target.value)} required/>
                          <input style={{ ...s.input, marginTop:10 }} type="text"
                            placeholder="Landmark (e.g. near Shiva temple, highway junction)"
                            value={landmark} onChange={e => setLandmark(e.target.value)}/>
                        </div>
                      </div>

                      {/* ─ RIGHT COLUMN ─ */}
                      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

                        {/* Labour + Cost */}
                        <div style={s.formCard}>
                          <div style={s.formCardHeader}>
                            <div style={{ ...s.formCardIcon, background:"#f5f3ff" }}><Users size={14} color="#7c3aed" strokeWidth={2.5}/></div>
                            <span style={s.formCardTitle}>Labour Count & Cost</span>
                          </div>

                          {availableNow===0 && date ? (
                            <div style={s.noLabourAlert}>
                              <AlertCircle size={18} color="#dc2626" strokeWidth={2}/>
                              <div>
                                <p style={{ color:"#dc2626", fontWeight:700, fontSize:14, margin:0 }}>No Labours Available</p>
                                <p style={{ color:"#9ca3af", fontSize:12, marginTop:2 }}>Try a different date or slot</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:24, marginBottom:14 }}>
                                <motion.button type="button" style={s.counterBtn}
                                  onClick={() => setLabourCount(Math.max(1,labourCount-1))} whileTap={{ scale:0.88 }}>−</motion.button>
                                <div style={{ textAlign:"center" }}>
                                  <span style={{ fontSize:46, fontWeight:900, color:"#1b4332", lineHeight:1, display:"block" }}>{labourCount}</span>
                                  <span style={{ fontSize:11, color:"#9ca3af", display:"block", marginTop:2 }}>of {availableNow} available</span>
                                </div>
                                <motion.button type="button" style={s.counterBtn}
                                  onClick={() => setLabourCount(Math.min(availableNow,labourCount+1))} whileTap={{ scale:0.88 }}>+</motion.button>
                              </div>
                              <div style={{ height:5, background:"#e8f5e9", borderRadius:4, overflow:"hidden", marginBottom:6 }}>
                                <motion.div style={{ height:"100%", background:"linear-gradient(90deg,#2d6a4f,#52b788)", borderRadius:4 }}
                                  animate={{ width:`${(labourCount/Math.max(availableNow,1))*100}%` }} transition={{ duration:0.3 }}/>
                              </div>
                              <p style={{ textAlign:"center", fontSize:11, color:"#9ca3af", marginBottom:16 }}>{labourCount} of {availableNow} selected</p>
                            </>
                          )}

                          <div style={s.costBreakdown}>
                            <div style={s.costRow}>
                              <span style={s.costLabel}>Labour Count</span>
                              <span style={s.costValue}>{labourCount}</span>
                            </div>
                            <div style={s.costRow}>
                              <span style={s.costLabel}>Rate per Labour</span>
                              <span style={s.costValue}>₹{ratePerLabour} ({SLOT_CONFIG[slot]?.label})</span>
                            </div>
                            <div style={s.costDivider}/>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <span style={{ fontSize:13, fontWeight:700, color:"#1b4332" }}>Total Cost</span>
                              <span style={{ fontSize:30, fontWeight:900, color:"#2d6a4f", letterSpacing:"-1px" }}>₹{totalCost.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        <div style={s.formCard}>
                          <div style={s.formCardHeader}>
                            <div style={{ ...s.formCardIcon, background:"#e0f2fe" }}><FileText size={14} color="#0284c7" strokeWidth={2.5}/></div>
                            <span style={s.formCardTitle}>Additional Notes</span>
                          </div>
                          <textarea style={{ ...s.input, minHeight:96, resize:"vertical" }}
                            placeholder="Field size, tools needed, specific instructions…"
                            value={description} onChange={e => setDescription(e.target.value)}/>
                        </div>

                        {/* Submit */}
                        <motion.button type="submit"
                          style={{ ...s.submitBtn, background:(loading||(date&&availableNow===0))?"#e4ede8":"linear-gradient(135deg,#2d6a4f,#40916c)", color:(loading||(date&&availableNow===0))?"#9ca3af":"#fff", cursor:(date&&availableNow===0)?"not-allowed":"pointer", boxShadow:(loading||(date&&availableNow===0))?"none":"0 6px 22px rgba(45,106,79,0.30)" }}
                          disabled={loading||(date&&availableNow===0)}
                          whileHover={{ scale:(loading||(date&&availableNow===0))?1:1.02, y:(loading||(date&&availableNow===0))?0:-2 }}
                          whileTap={{ scale:0.98 }}>
                          {loading
                            ? <motion.div style={{ width:18, height:18, border:"2px solid rgba(255,255,255,0.35)", borderTop:"2px solid #fff", borderRadius:"50%" }} animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:0.75, ease:"linear" }}/>
                            : (date&&availableNow===0 ? "No Labours Available" : `Submit Booking · ₹${totalCost.toLocaleString()}`)
                          }
                        </motion.button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ══ BOOKINGS TAB ══ */}
              {activeTab==="bookings" && (
                <motion.div key="bookings" initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-18 }} transition={{ duration:0.25 }}>

                  <div style={s.pageHeader}>
                    <div>
                      <h1 style={s.pageTitle}>My Bookings</h1>
                      <p style={s.pageSubtitle}>{bookings.length} total booking{bookings.length!==1?"s":""}</p>
                    </div>
                    <motion.button style={s.newBookingBtn} onClick={() => setActiveTab("book")} whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
                      <Plus size={14} strokeWidth={2.5}/> New Booking
                    </motion.button>
                  </div>

                  {/* Sub-tabs */}
                  <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
                    {[
                      { id:"live",       label:"Live Work",      count:liveBookings.length,       activeBg:"#f0fdf4", activeBorder:"#52b788", activeColor:"#1b4332", dot:"#2d6a4f" },
                      { id:"completed",  label:"Completed",      count:completedBookings.length,  activeBg:"#f5f3ff", activeBorder:"#c4b5fd", activeColor:"#3730a3", dot:"#6366f1" },
                      { id:"unassigned", label:"Unassigned",     count:unassignedBookings.length, activeBg:"#fef9f0", activeBorder:"#fde68a", activeColor:"#92400e", dot:"#b45309" },
                    ].map(tab => {
                      const isActive = bookingSubTab === tab.id;
                      return (
                        <motion.button key={tab.id}
                          style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:24, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, transition:"all 0.15s",
                            border:`1.5px solid ${isActive?tab.activeBorder:"#e4ede8"}`,
                            background:isActive?tab.activeBg:"#fff",
                            color:isActive?tab.activeColor:"#6b7280",
                            boxShadow:isActive?`0 2px 10px ${tab.activeBorder}60`:"0 1px 4px rgba(0,0,0,0.04)" }}
                          onClick={() => setBookingSubTab(tab.id)}
                          whileHover={{ scale:1.02 }} whileTap={{ scale:0.96 }}>
                          {isActive && <div style={{ width:6, height:6, borderRadius:"50%", background:tab.dot, flexShrink:0 }}/>}
                          {tab.label}
                          <span style={{ background:isActive?"rgba(0,0,0,0.07)":"#f3f4f6", color:isActive?tab.activeColor:"#9ca3af", fontSize:11, fontWeight:800, padding:"1px 8px", borderRadius:20 }}>{tab.count}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <AnimatePresence mode="wait">
                    {bookingSubTab==="live" && (
                      <motion.div key="live" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.18 }}>
                        <div style={s.subTabInfo("#f0fdf4","#bbf7d0","#2d6a4f")}>
                          <Activity size={13} color="#2d6a4f" strokeWidth={2}/>
                          <span>Assigned bookings in progress — awaiting confirmation from both sides.</span>
                        </div>
                        {liveBookings.length===0
                          ? <EmptyState icon="🌾" title="No active work" subtitle="Your assigned in-progress bookings appear here." action="Book Labour" onAction={() => setActiveTab("book")}/>
                          : <div style={{ display:"flex", flexDirection:"column", gap:14 }}>{liveBookings.map(b => renderBookingCard(b))}</div>}
                      </motion.div>
                    )}
                    {bookingSubTab==="completed" && (
                      <motion.div key="completed" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.18 }}>
                        <div style={s.subTabInfo("#f5f3ff","#c4b5fd","#4f46e5")}>
                          <CheckCircle2 size={13} color="#6366f1" strokeWidth={2}/>
                          <span>Bookings confirmed as completed by both you and the supervisor.</span>
                        </div>
                        {completedBookings.length===0
                          ? <EmptyState icon="✅" title="No completed bookings yet" subtitle="Once both sides confirm, bookings appear here."/>
                          : <div style={{ display:"flex", flexDirection:"column", gap:14 }}>{completedBookings.map(b => renderBookingCard(b))}</div>}
                      </motion.div>
                    )}
                    {bookingSubTab==="unassigned" && (
                      <motion.div key="unassigned" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.18 }}>
                        <div style={s.subTabInfo("#fef9f0","#fde68a","#92400e")}>
                          <AlertCircle size={13} color="#b45309" strokeWidth={2}/>
                          <span>Pending requests awaiting supervisor assignment.</span>
                        </div>
                        {unassignedBookings.length===0
                          ? <EmptyState icon="⏳" title="No pending requests" subtitle="All your bookings have been assigned." action="Book Labour" onAction={() => setActiveTab("book")}/>
                          : <div style={{ display:"flex", flexDirection:"column", gap:14 }}>{unassignedBookings.map(b => renderBookingCard(b))}</div>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}

// ── Design tokens ──
const s = {
  // Sidebar
  sidebarBrand:    { display:"flex", alignItems:"center", gap:10, padding:"22px 20px 18px" },
  sidebarLogoMark: { width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#2d6a4f,#1b4332)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 10px rgba(45,106,79,0.28)" },
  sidebarBrandName:{ fontSize:16, fontWeight:800, color:"#1b4332", letterSpacing:"-0.3px" },
  sidebarBrandSub: { fontSize:9, color:"#52b788", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.8px", marginTop:1 },

  profileCard: { margin:"0 12px 18px", padding:"14px 13px", background:"#f4fdf6", border:"1px solid #d8f3dc", borderRadius:14, display:"flex", alignItems:"center", gap:10 },
  profileAvatar: { width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#2d6a4f,#52b788)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#fff", flexShrink:0 },
  profileName:   { fontSize:13, fontWeight:700, color:"#1b4332", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  profileMeta:   { display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#8aab97", marginTop:3 },

  navSectionLabel: { padding:"0 20px 8px", fontSize:10, fontWeight:700, color:"#c0d5c8", textTransform:"uppercase", letterSpacing:"1px" },
  navBtn: { width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", marginBottom:3, fontFamily:"inherit", borderLeft:"3px solid transparent", transition:"all 0.15s" },
  navBtnLabel: { fontSize:13, fontWeight:600, flex:1, textAlign:"left" },
  navBadge: { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 },

  subNavBtn: { width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, border:"none", cursor:"pointer", marginBottom:2, fontFamily:"inherit", transition:"all 0.15s" },

  sidebarStats: { margin:"12px 12px 14px", padding:"14px 16px", background:"#f4fdf6", border:"1px solid #d8f3dc", borderRadius:14, display:"flex" },
  logoutBtn: { margin:"0 12px", padding:"11px 14px", background:"#fff0f0", border:"1px solid #fecaca", borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"inherit" },

  availPill: { fontSize:12, color:"#2d6a4f", fontWeight:700, background:"#f0fdf4", padding:"4px 11px", borderRadius:20, border:"1px solid #b7e4c7" },

  // Page layout
  pageHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:26, flexWrap:"wrap", gap:12 },
  pageTitle:  { fontSize:"clamp(20px,4vw,26px)", fontWeight:800, color:"#1b4332", letterSpacing:"-0.5px" },
  pageSubtitle: { fontSize:13, color:"#8aab97", marginTop:4 },
  ratePill:   { display:"flex", alignItems:"center", gap:7, background:"#fff", border:"1.5px solid #e4ede8", padding:"8px 16px", borderRadius:24, fontSize:12, color:"#2d6a4f", fontWeight:600, boxShadow:"0 1px 5px rgba(27,67,50,0.05)", whiteSpace:"nowrap" },
  newBookingBtn: { display:"flex", alignItems:"center", gap:6, padding:"9px 18px", background:"#f4fdf6", border:"1.5px solid #52b788", borderRadius:10, color:"#2d6a4f", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },

  // Form cards
  formCard: { background:"#fff", border:"1px solid #e4ede8", borderRadius:16, padding:20, boxShadow:"0 1px 8px rgba(27,67,50,0.05)" },
  formCardHeader: { display:"flex", alignItems:"center", gap:9, marginBottom:14 },
  formCardIcon: { width:30, height:30, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  formCardTitle: { fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.6px" },

  input: { width:"100%", padding:"11px 13px", background:"#fafcfb", border:"1.5px solid #e4ede8", borderRadius:10, fontSize:13.5, color:"#1a1a1a", boxSizing:"border-box", outline:"none", fontFamily:"'Poppins','Segoe UI',sans-serif", transition:"border-color 0.18s, box-shadow 0.18s" },
  emptySlotHint: { marginTop:12, padding:"12px 14px", background:"#fafcfb", borderRadius:10, fontSize:12, color:"#9ca3af", textAlign:"center", border:"1px dashed #e4ede8" },

  noLabourAlert: { display:"flex", alignItems:"center", gap:12, padding:14, background:"#fff8f8", border:"1.5px solid #fca5a5", borderRadius:10, marginBottom:12 },
  counterBtn: { width:42, height:42, borderRadius:"50%", background:"#f4fdf6", border:"1.5px solid #52b788", color:"#2d6a4f", fontSize:22, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", flexShrink:0 },

  costBreakdown: { background:"#fafcfb", border:"1px solid #e4ede8", borderRadius:12, padding:16 },
  costRow: { display:"flex", justifyContent:"space-between", padding:"4px 0" },
  costLabel: { fontSize:12, color:"#8aab97" },
  costValue: { fontSize:12, color:"#1b4332", fontWeight:600 },
  costDivider: { height:1, background:"#e4ede8", margin:"10px 0" },

  submitBtn: { width:"100%", padding:"15px", border:"none", borderRadius:12, fontSize:14, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"'Poppins','Segoe UI',sans-serif", transition:"all 0.2s" },

  // Booking cards
  bookingCard: { background:"#fff", border:"1px solid #e4ede8", borderRadius:16, padding:"18px 20px", boxShadow:"0 1px 6px rgba(27,67,50,0.05)", transition:"box-shadow 0.2s, transform 0.2s" },
  cardTopBar:  { display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 },
  cardDivider: { height:1, background:"#f0f4f2", margin:"14px 0" },
  dateBadge:   { display:"flex", alignItems:"center", gap:5, background:"#f4fdf6", border:"1px solid #b7e4c7", padding:"4px 10px", borderRadius:20, fontSize:12, color:"#2d6a4f", fontWeight:600 },
  statusBadge: { display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" },
  partialBadge:{ display:"flex", alignItems:"center", gap:4, background:"#fffbeb", border:"1px solid #fde68a", padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:700, color:"#92400e" },
  costTag:     { fontSize:20, fontWeight:900, color:"#1b4332", letterSpacing:"-0.5px" },
  detailsGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 8px", marginBottom:14 },
  detailItem:  { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#6b7280" },

  supervisorBlock: { background:"#f0f7ff", border:"1px solid #bfdbfe", borderRadius:12, padding:"12px 14px", marginBottom:12 },
  supervisorLabel: { display:"flex", alignItems:"center", gap:5, color:"#1d4ed8", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.5px", margin:0 },
  supervisorAvatar:{ width:36, height:36, borderRadius:"50%", background:"#dbeafe", border:"1.5px solid #93c5fd", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#1d4ed8", flexShrink:0 },

  attendanceBlock:  { background:"#f8fdf9", border:"1px solid #d8f3dc", borderRadius:12, padding:"12px 14px", marginBottom:12 },
  attendanceHeader: { display:"flex", alignItems:"center", gap:7, color:"#2d6a4f", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.5px" },
  attendanceNote:   { marginTop:7, fontSize:11, color:"#8aab97", padding:"6px 10px", background:"#f0fdf4", borderRadius:8, border:"1px solid #d8f3dc" },
  labourRow:        { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 11px", borderRadius:9, border:"1px solid" },
  attendBtn:        { padding:"5px 12px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer", border:"none", fontFamily:"inherit", flexShrink:0 },
  attendanceSummary:{ display:"flex", gap:18, marginTop:10, paddingTop:8, borderTop:"1px solid #d8f3dc" },

  confirmBtn: { width:"100%", padding:11, background:"#f4fdf6", border:"1.5px solid #86efac", borderRadius:10, color:"#15803d", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, fontFamily:"inherit", marginTop:4 },
  confirmedBar: { display:"flex", alignItems:"center", gap:7, padding:"8px 12px", marginTop:4, background:"#f4fdf6", border:"1px solid #b7e4c7", borderRadius:9, fontSize:12, color:"#15803d", fontWeight:600, flexWrap:"wrap" },

  emptyState: { textAlign:"center", padding:"60px 40px", background:"#fff", border:"1px solid #e4ede8", borderRadius:20, boxShadow:"0 1px 8px rgba(27,67,50,0.05)" },
  emptyActionBtn: { padding:"11px 28px", background:"linear-gradient(135deg,#2d6a4f,#40916c)", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(45,106,79,0.28)" },
};

// Helper for sub-tab info bar
s.subTabInfo = (bg, border, color) => ({ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", background:bg, border:`1px solid ${border}`, borderRadius:10, marginBottom:16, fontSize:12, color });