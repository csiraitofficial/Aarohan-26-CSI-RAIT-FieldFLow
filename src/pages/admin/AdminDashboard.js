import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../../firebase";
import {
  collection, doc, getDoc, onSnapshot,
  updateDoc, addDoc, deleteDoc, setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, Users, ClipboardList, Wallet,
  LogOut, Plus, Trash2, Phone, Calendar,
  MapPin, FileText, Sun, Sunset, Sunrise, User,
  AlertCircle, CheckCircle2, XCircle, Eye,
  UserPlus, Shield, AlertTriangle, TrendingUp, Navigation,
  Activity, ChevronRight, Clock, Check, X, Loader2,
} from "lucide-react";

/* ─── constants ─────────────────────────────────────────── */
const SLOT_CFG = {
  "8-12":  { label:"Morning",   time:"8AM–12PM", icon:Sunrise, color:"#b45309", rate:300 },
  "2-6":   { label:"Afternoon", time:"2PM–6PM",  icon:Sunset,  color:"#c2410c", rate:300 },
  fullday: { label:"Full Day",  time:"8AM–6PM",  icon:Sun,     color:"#2d6a4f", rate:600 },
};
const WORK_TYPES = ["Harvesting","Planting","Weeding","Irrigation","Spraying","Tilling","Loading","Other"];
const LABOUR_MONTHLY = 6000;
const SUP_MONTHLY    = 8000;
const today = new Date().toISOString().split("T")[0];

/* ─── Minimal SVG Pie ──────────────────────────────────── */
function PieChart({ slices, size = 140 }) {
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  let cumAngle = -Math.PI / 2;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280", fontSize:12, fontFamily:"inherit" }}>
      No data
    </div>
  );
  return (
    <svg width={size} height={size}>
      {slices.map((sl, i) => {
        const angle = (sl.value / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(cumAngle);
        const y1 = cy + r * Math.sin(cumAngle);
        cumAngle += angle;
        const x2 = cx + r * Math.cos(cumAngle);
        const y2 = cy + r * Math.sin(cumAngle);
        const large = angle > Math.PI ? 1 : 0;
        return (
          <path key={i}
            d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`}
            fill={sl.color} stroke="#fff" strokeWidth={2.5} />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.52} fill="#fff" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1b4332" fontFamily="'DM Sans', sans-serif">
        {total}
      </text>
    </svg>
  );
}

/* ─── Bar Chart ──────────────────────────────────────────── */
function BarChart({ data, color = "#2d6a4f", height = 100 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 36, gap = 14;
  const totalW = data.length * (w + gap);
  return (
    <svg width={totalW} height={height + 34}>
      {data.map((d, i) => {
        const barH = (d.value / max) * height;
        const x = i * (w + gap);
        const y = height - barH;
        return (
          <g key={i}>
            <rect x={x} y={height} width={w} height={0} fill={color} rx={3} opacity={0} >
              <animate attributeName="height" from={0} to={barH} dur="0.6s" fill="freeze" begin={`${i * 0.05}s`}/>
              <animate attributeName="y" from={height} to={y} dur="0.6s" fill="freeze" begin={`${i * 0.05}s`}/>
              <animate attributeName="opacity" from={0} to={0.82} dur="0.4s" fill="freeze" begin={`${i * 0.05}s`}/>
            </rect>
            <text x={x + w / 2} y={height + 18} textAnchor="middle" fontSize={10} fill="#9ca3af" fontFamily="'DM Sans', sans-serif">{d.label}</text>
            {d.value > 0 && <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1b4332" fontFamily="'DM Sans', sans-serif">{d.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Leaflet Map ────────────────────────────────────────── */
function SupervisorLiveMap({ lat, lng, name }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!lat || !lng || !mapRef.current) return;
    const initMap = () => {
      const L = window.L;
      if (!L) return;
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstanceRef.current);
      } else {
        mapInstanceRef.current.setView([lat, lng], 15);
      }
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;background:#1d4ed8;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(29,78,216,0.45);display:flex;align-items:center;justify-content:center;"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`${name} — Live Location`)
          .openPopup();
      }
    };
    if (window.L) {
      initMap();
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [lat, lng, name]);

  return <div ref={mapRef} style={{ width: "100%", height: "210px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }} />;
}

/* ─── Location Modal ─────────────────────────────────────── */
function SupervisorLocationModal({ supervisor, onClose }) {
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    if (!supervisor?.id) return;
    const unsub = onSnapshot(doc(db, "users", supervisor.id), (snap) => {
      if (snap.exists()) setLiveData(snap.data());
    });
    return () => unsub();
  }, [supervisor?.id]);

  const hasLocation = liveData?.supervisorLat && liveData?.supervisorLng;
  const mapsLink = hasLocation
    ? `https://www.google.com/maps?q=${liveData.supervisorLat},${liveData.supervisorLng}`
    : null;
  const lastUpdated = liveData?.supervisorLocationUpdatedAt
    ? new Date(liveData.supervisorLocationUpdatedAt.toDate?.() || liveData.supervisorLocationUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <motion.div style={A.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div style={{ ...A.modal, maxWidth: 480 }}
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={e => e.stopPropagation()}>
        <div style={A.modalHeader}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ ...A.avatarSm, backgroundColor:"#eff6ff", color:"#1d4ed8", border:"1.5px solid #bfdbfe" }}>
              {supervisor.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>{supervisor.name}</div>
              <div style={{ fontSize:11, color:"#94a3b8", letterSpacing:"0.02em" }}>LIVE LOCATION TRACKING</div>
            </div>
          </div>
          <button style={A.iconClose} onClick={onClose}><X size={16}/></button>
        </div>

        <div style={{
          display:"flex", alignItems:"center", gap:8,
          padding:"8px 12px", borderRadius:7, marginBottom:14,
          backgroundColor: hasLocation ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${hasLocation ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <div style={{ width:7, height:7, borderRadius:"50%", backgroundColor: hasLocation ? "#16a34a" : "#ef4444", flexShrink:0 }} />
          <span style={{ fontSize:12, fontWeight:600, color: hasLocation ? "#15803d" : "#dc2626" }}>
            {hasLocation ? "Actively sharing location" : "Location sharing disabled"}
          </span>
          {lastUpdated && hasLocation && (
            <span style={{ fontSize:11, color:"#94a3b8", marginLeft:"auto" }}>Updated {lastUpdated}</span>
          )}
        </div>

        {hasLocation ? (
          <>
            <SupervisorLiveMap lat={liveData.supervisorLat} lng={liveData.supervisorLng} name={supervisor.name} />
            <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", gap:8 }}>
                {[["Latitude", liveData.supervisorLat.toFixed(6)], ["Longitude", liveData.supervisorLng.toFixed(6)]].map(([k,v]) => (
                  <div key={k} style={{ flex:1, padding:"9px 12px", backgroundColor:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:7 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.6, marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", fontVariantNumeric:"tabular-nums" }}>{v}</div>
                  </div>
                ))}
              </div>
              <a href={mapsLink} target="_blank" rel="noreferrer" style={A.mapLink}>
                <Navigation size={13}/>Open in Google Maps
              </a>
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"40px 20px", backgroundColor:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10 }}>
            <div style={{ width:48, height:48, borderRadius:"50%", backgroundColor:"#f1f5f9", border:"1.5px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
              <Navigation size={20} color="#94a3b8"/>
            </div>
            <p style={{ fontSize:14, fontWeight:600, color:"#374151", margin:"0 0 5px" }}>Location unavailable</p>
            <p style={{ fontSize:12, color:"#94a3b8", margin:0 }}>
              {supervisor.name} has not enabled location sharing from their dashboard.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const [activeTab,   setActiveTab]   = useState("overview");
  const [bookingTab,  setBookingTab]  = useState("live");
  const [allBookings, setAllBookings] = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [allLabours,  setAllLabours]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [authReady,   setAuthReady]   = useState(false);

  const [addSupModal,    setAddSupModal]    = useState(false);
  const [addLabourModal, setAddLabourModal] = useState(false);
  const [detailModal,    setDetailModal]    = useState(null);
  const [locationModal,  setLocationModal]  = useState(null);

  const [bFarmerId,        setBFarmerId]        = useState("");
  const [bSupervisorId,    setBSupervisorId]    = useState("");
  const [bDate,            setBDate]            = useState("");
  const [bSlot,            setBSlot]            = useState("8-12");
  const [bWorkType,        setBWorkType]        = useState("Harvesting");
  const [bAddress,         setBAddress]         = useState("");
  const [bLandmark,        setBLandmark]        = useState("");
  const [bSelectedLabours, setBSelectedLabours] = useState([]);

  const [supName, setSupName] = useState("");
  const [supPhone,setSupPhone]= useState("");
  const [supEmail,setSupEmail]= useState("");
  const [supPass, setSupPass] = useState("");

  const [labName, setLabName] = useState("");
  const [labPhone,setLabPhone]= useState("");
  const [labSupId,setLabSupId]= useState("");

  const navigate = useNavigate();

  /* ── FIX: Use onAuthStateChanged to prevent logout on refresh ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      } else {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!authReady) return;
    const u1 = onSnapshot(collection(db,"bookings"), snap => setAllBookings(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(collection(db,"users"),    snap => setAllUsers(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(collection(db,"labours"),  snap => setAllLabours(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, [authReady]);

  const farmers     = allUsers.filter(u => u.role === "farmer");
  const supervisors = allUsers.filter(u => u.role === "supervisor");

  const isLabourFree = (labour, date, slot) => {
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
  const freeLabours = (date, slot, supId) =>
    allLabours.filter(l => (!supId || l.supervisorId === supId) && isLabourFree(l, date, slot));

  const revenue    = allBookings.filter(b=>b.status!=="pending").reduce((s,b)=>s+(b.totalCost||0),0);
  const labSalary  = allLabours.length  * LABOUR_MONTHLY;
  const supSalary  = supervisors.length * SUP_MONTHLY;
  const liveB      = allBookings.filter(b=>b.status==="assigned");
  const pendingB   = allBookings.filter(b=>b.status==="pending");
  const completedB = allBookings.filter(b=>b.status==="completed");
  const mismatches = allBookings.filter(b=>b.status==="assigned"&&(b.farmerConfirmed||b.supervisorConfirmed)&&b.farmerConfirmed!==b.supervisorConfirmed);
  const holidaysToday = allLabours.filter(l=>Object.keys(l.unavailability||{}).some(k=>k.startsWith(today)));

  const handleAddSup = async (e) => {
    e.preventDefault();
    if (!supName||!supPhone||!supEmail||!supPass){toast.error("All fields are required."); return;}
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, supEmail, supPass);
      await setDoc(doc(db,"users",cred.user.uid),{ name:supName,phone:supPhone,email:supEmail,role:"supervisor",labourCount:0,createdAt:new Date() });
      toast.success(`Supervisor ${supName} created successfully.`);
      setAddSupModal(false); setSupName(""); setSupPhone(""); setSupEmail(""); setSupPass("");
    } catch(err){ toast.error(err.code==="auth/email-already-in-use"?"Email already in use.":"Failed to create supervisor."); }
    setLoading(false);
  };

  const handleAddLabour = async (e) => {
    e.preventDefault();
    if (!labName||!labPhone||!labSupId){toast.error("All fields are required."); return;}
    setLoading(true);
    try {
      const sup = supervisors.find(s=>s.id===labSupId);
      await addDoc(collection(db,"labours"),{ name:labName,phone:labPhone,supervisorId:labSupId,supervisorName:sup?.name,available:true,unavailability:{},createdAt:new Date() });
      toast.success(`${labName} added to team.`);
      setAddLabourModal(false); setLabName(""); setLabPhone(""); setLabSupId("");
    } catch{ toast.error("Failed to add labour."); }
    setLoading(false);
  };

  const delSupervisor = async (id, name) => {
    if (!window.confirm(`Remove supervisor ${name}? This cannot be undone.`)) return;
    await deleteDoc(doc(db,"users",id));
    toast.success(`${name} removed.`);
  };
  const delLabour = async (id, name) => {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    await deleteDoc(doc(db,"labours",id));
    toast.success(`${name} removed.`);
  };

  const handleAdminBook = async () => {
    if (!bFarmerId||!bSupervisorId||!bDate||!bAddress){toast.error("Farmer, supervisor, date and address are required."); return;}
    if (bSelectedLabours.length===0){toast.error("Select at least one labour."); return;}
    const farmer  = farmers.find(f=>f.id===bFarmerId);
    const sup     = supervisors.find(s=>s.id===bSupervisorId);
    const chosen  = allLabours.filter(l=>bSelectedLabours.includes(l.id));
    const rate    = SLOT_CFG[bSlot]?.rate||300;
    setLoading(true);
    try {
      await addDoc(collection(db,"bookings"),{
        farmerId:bFarmerId, farmerName:farmer?.name, farmerPhone:farmer?.phone, village:farmer?.village,
        farmAddress:bAddress, landmark:bLandmark,
        supervisorId:bSupervisorId, supervisorName:sup?.name, supervisorPhone:sup?.phone,
        labourCount:bSelectedLabours.length, assignedLabour:bSelectedLabours.length,
        assignedLabourIds:bSelectedLabours, assignedLabourNames:chosen.map(l=>l.name),
        timeSlot:bSlot, workType:bWorkType, date:bDate,
        totalCost:bSelectedLabours.length*rate, ratePerLabour:rate,
        status:"assigned", farmerConfirmed:false, supervisorConfirmed:false,
        labourAttendance:{}, bookedByAdmin:true, createdAt:new Date(),
      });
      toast.success("Booking created and assigned.");
      setBFarmerId(""); setBSupervisorId(""); setBDate(""); setBAddress(""); setBLandmark(""); setBSelectedLabours([]);
    } catch{ toast.error("Failed to create booking."); }
    setLoading(false);
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  const statusStyle = (s) => {
    if (s==="pending")   return {bg:"#fefce8", color:"#854d0e", border:"#fde047"};
    if (s==="assigned")  return {bg:"#f0fdf4", color:"#166534", border:"#86efac"};
    if (s==="completed") return {bg:"#eff6ff", color:"#1e40af", border:"#93c5fd"};
    return {bg:"#f8fafc", color:"#374151", border:"#e2e8f0"};
  };

  const availNow = bDate && bSlot && bSupervisorId ? freeLabours(bDate, bSlot, bSupervisorId) : [];

  const groupByDate = (list) => {
    const map = {};
    [...list].sort((a,b)=>a.date?.localeCompare(b.date)).forEach(b=>{
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    return map;
  };

  const TABS = [
    {id:"overview",    icon:LayoutDashboard, label:"Overview"},
    {id:"bookings",    icon:ClipboardList,   label:"Bookings",   badge: pendingB.length + mismatches.length},
    {id:"book",        icon:Plus,            label:"New Booking"},
    {id:"supervisors", icon:Shield,          label:"Supervisors"},
    {id:"labours",     icon:Users,           label:"Labours"},
    {id:"farmers",     icon:User,            label:"Farmers"},
    {id:"finance",     icon:Wallet,          label:"Finance"},
  ];

  const bookTabData  = { live: liveB, pending: pendingB, completed: completedB };

  /* Loading screen while auth resolves */
  if (!authReady) {
    return (
      <div style={{ minHeight:"100vh", backgroundColor:"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans', sans-serif" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#2d6a4f,#1b4332)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:"0 4px 14px rgba(45,106,79,.3)" }}>
            <Activity size={20} color="#fff"/>
          </div>
          <p style={{ fontSize:14, color:"#64748b", fontWeight:500 }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={A.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus {
          outline: none !important;
          border-color: #2d6a4f !important;
          box-shadow: 0 0 0 3px rgba(45,106,79,0.12) !important;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
        a { transition: opacity .15s; }
        a:hover { opacity: .78; }
      `}</style>

      <Toaster position="top-right" toastOptions={{
        style:{ fontFamily:"'DM Sans', sans-serif", fontSize:13, borderRadius:9, border:"1px solid #e2e8f0", boxShadow:"0 4px 16px rgba(0,0,0,.08)", color:"#0f172a", padding:"10px 14px" },
        success:{ iconTheme:{ primary:"#2d6a4f", secondary:"#fff" } },
      }} />

      {/* ════ ADD SUPERVISOR MODAL ════ */}
      <AnimatePresence>
        {addSupModal && (
          <motion.div style={A.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div style={A.modal} initial={{scale:0.96,y:16}} animate={{scale:1,y:0}} exit={{scale:0.96,y:16}}>
              <div style={A.modalHeader}>
                <h3 style={A.modalTitle}>Add Supervisor</h3>
                <button style={A.iconClose} onClick={()=>setAddSupModal(false)}><X size={16}/></button>
              </div>
              <form onSubmit={handleAddSup} style={{display:"flex",flexDirection:"column",gap:14}}>
                {[
                  {lbl:"Full Name",   val:supName,  set:setSupName,  type:"text",     ph:"Enter full name"},
                  {lbl:"Phone",       val:supPhone, set:setSupPhone, type:"tel",      ph:"10-digit number"},
                  {lbl:"Email",       val:supEmail, set:setSupEmail, type:"email",    ph:"Email address"},
                  {lbl:"Password",    val:supPass,  set:setSupPass,  type:"password", ph:"Min. 6 characters"},
                ].map(f=>(
                  <div key={f.lbl}>
                    <label style={A.label}>{f.lbl}</label>
                    <input style={A.inp} type={f.type} placeholder={f.ph} value={f.val} onChange={e=>f.set(e.target.value)} />
                  </div>
                ))}
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <button type="submit" style={A.primaryBtn} disabled={loading}>
                    {loading ? <><Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> Creating…</> : "Create Supervisor"}
                  </button>
                  <button type="button" style={A.ghostBtn} onClick={()=>setAddSupModal(false)}>Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ ADD LABOUR MODAL ════ */}
      <AnimatePresence>
        {addLabourModal && (
          <motion.div style={A.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <motion.div style={A.modal} initial={{scale:0.96,y:16}} animate={{scale:1,y:0}} exit={{scale:0.96,y:16}}>
              <div style={A.modalHeader}>
                <h3 style={A.modalTitle}>Add Labour</h3>
                <button style={A.iconClose} onClick={()=>setAddLabourModal(false)}><X size={16}/></button>
              </div>
              <form onSubmit={handleAddLabour} style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <label style={A.label}>Full Name</label>
                  <input style={A.inp} type="text" placeholder="Enter full name" value={labName} onChange={e=>setLabName(e.target.value)} />
                </div>
                <div>
                  <label style={A.label}>Phone</label>
                  <input style={A.inp} type="tel" placeholder="10-digit number" value={labPhone} onChange={e=>setLabPhone(e.target.value)} maxLength={10} />
                </div>
                <div>
                  <label style={A.label}>Assign to Supervisor</label>
                  <select style={A.inp} value={labSupId} onChange={e=>setLabSupId(e.target.value)}>
                    <option value="">Select supervisor…</option>
                    {supervisors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <button type="submit" style={A.primaryBtn} disabled={loading}>
                    {loading ? <><Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> Adding…</> : "Add Labour"}
                  </button>
                  <button type="button" style={A.ghostBtn} onClick={()=>setAddLabourModal(false)}>Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ DETAIL MODAL ════ */}
      <AnimatePresence>
        {detailModal && (
          <motion.div style={A.overlay} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDetailModal(null)}>
            <motion.div style={{...A.modal,maxWidth:520}} initial={{scale:0.96,y:16}} animate={{scale:1,y:0}} exit={{scale:0.96,y:16}} onClick={e=>e.stopPropagation()}>
              <div style={A.modalHeader}>
                <h3 style={A.modalTitle}>
                  {detailModal.type==="booking" ? "Booking Details"
                    : detailModal.type==="labour" ? "Labour Details"
                    : detailModal.type==="farmer" ? "Farmer Details"
                    : "Supervisor Details"}
                </h3>
                <button style={A.iconClose} onClick={()=>setDetailModal(null)}><X size={16}/></button>
              </div>

              {(detailModal.type==="farmer"||detailModal.type==="supervisor") && (
                <div style={{display:"flex",flexDirection:"column",gap:1}}>
                  {[["Name",detailModal.data.name],["Email",detailModal.data.email],["Phone",detailModal.data.phone],["Village",detailModal.data.village],["Role",detailModal.data.role],["Crops",Array.isArray(detailModal.data.cropType)?detailModal.data.cropType.join(", "):detailModal.data.cropType],["Farm Size",detailModal.data.farmSize]].filter(([,v])=>v).map(([k,v])=>(
                    <div key={k} style={A.dRow}><span style={A.dKey}>{k}</span><span style={A.dVal}>{v}</span></div>
                  ))}
                  {detailModal.type==="supervisor"&&(
                    <>
                      <div style={A.dRow}><span style={A.dKey}>Labours</span><span style={A.dVal}>{allLabours.filter(l=>l.supervisorId===detailModal.data.id).length}</span></div>
                      <div style={A.dRow}><span style={A.dKey}>Active Jobs</span><span style={A.dVal}>{allBookings.filter(b=>b.supervisorId===detailModal.data.id&&b.status==="assigned").length}</span></div>
                    </>
                  )}
                </div>
              )}

              {detailModal.type==="labour"&&(
                <div style={{display:"flex",flexDirection:"column",gap:1}}>
                  {[["Name",detailModal.data.name],["Phone",detailModal.data.phone],["Supervisor",detailModal.data.supervisorName]].map(([k,v])=>(
                    <div key={k} style={A.dRow}><span style={A.dKey}>{k}</span><span style={A.dVal}>{v||"—"}</span></div>
                  ))}
                  <div style={{marginTop:16,marginBottom:6}}>
                    <span style={A.label}>Unavailability Schedule</span>
                  </div>
                  {Object.entries(detailModal.data.unavailability||{}).length===0
                    ?<p style={{fontSize:13,color:"#94a3b8",padding:"12px 0"}}>No unavailability on record.</p>
                    :Object.entries(detailModal.data.unavailability||{}).map(([key,reason])=>{
                      const [d,s]=key.split("_");
                      return(
                        <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",backgroundColor:"#fef2f2",borderRadius:7,border:"1px solid #fecaca",marginBottom:4}}>
                          <span style={{fontSize:12,color:"#dc2626",fontWeight:600}}>{d} · {SLOT_CFG[s]?.label||s}</span>
                          <span style={{fontSize:12,color:"#94a3b8"}}>{reason}</span>
                        </div>
                      );
                    })
                  }
                </div>
              )}

              {detailModal.type==="booking"&&(
                <div style={{display:"flex",flexDirection:"column",gap:1}}>
                  {[
                    ["Date",detailModal.data.date],
                    ["Slot",`${SLOT_CFG[detailModal.data.timeSlot]?.label} · ${SLOT_CFG[detailModal.data.timeSlot]?.time}`],
                    ["Farmer",detailModal.data.farmerName],["Phone",detailModal.data.farmerPhone],
                    ["Address",detailModal.data.farmAddress],["Landmark",detailModal.data.landmark],
                    ["Work Type",detailModal.data.workType],
                    ["Labour Requested",detailModal.data.labourCount],
                    ["Labour Assigned",detailModal.data.assignedLabour||0],
                    ["Supervisor",detailModal.data.supervisorName],["Supervisor Phone",detailModal.data.supervisorPhone],
                    ["Total Cost","₹"+(detailModal.data.totalCost||0).toLocaleString()],
                    ["Status",detailModal.data.status],
                    ["Farmer Confirmed",detailModal.data.farmerConfirmed?"Yes":"No"],
                    ["Supervisor Confirmed",detailModal.data.supervisorConfirmed?"Yes":"No"],
                  ].filter(([,v])=>v!=null).map(([k,v])=>(
                    <div key={k} style={A.dRow}><span style={A.dKey}>{k}</span><span style={A.dVal}>{v}</span></div>
                  ))}

                  {detailModal.data.farmLat && detailModal.data.farmLng && (
                    <div style={{marginTop:12}}>
                      <a href={`https://www.google.com/maps?q=${detailModal.data.farmLat},${detailModal.data.farmLng}`}
                        target="_blank" rel="noreferrer" style={A.mapLink}>
                        <MapPin size={12}/>View farm location on Google Maps
                      </a>
                    </div>
                  )}

                  {detailModal.data.supervisorVisitedFarm===true && (
                    <div style={{padding:"9px 12px",backgroundColor:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,fontSize:12,fontWeight:600,color:"#15803d",marginTop:8}}>
                      Supervisor visited farm
                      {detailModal.data.supervisorVisitDistance!=null&&` · ${detailModal.data.supervisorVisitDistance}m from farm`}
                    </div>
                  )}
                  {detailModal.data.supervisorVisitedFarm===false&&detailModal.data.supervisorVisitedAt&&(
                    <div style={{padding:"9px 12px",backgroundColor:"#fffbeb",border:"1px solid #fde68a",borderRadius:7,fontSize:12,fontWeight:600,color:"#92400e",marginTop:8}}>
                      Supervisor confirmed remotely — not near farm
                      {detailModal.data.supervisorVisitDistance!=null&&` · ${detailModal.data.supervisorVisitDistance}m from farm`}
                    </div>
                  )}

                  {detailModal.data.assignedLabourNames?.length>0&&(
                    <>
                      <div style={{marginTop:16,marginBottom:6}}><span style={A.label}>Labour Attendance</span></div>
                      {detailModal.data.assignedLabourNames.map((name,idx)=>{
                        const lid=detailModal.data.assignedLabourIds?.[idx];
                        const present=detailModal.data.labourAttendance?.[lid]===true;
                        return(
                          <div key={idx} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:7,border:`1px solid ${present?"#bbf7d0":"#fecaca"}`,backgroundColor:present?"#f0fdf4":"#fef2f2",marginBottom:4}}>
                            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{name}</span>
                            <span style={{display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,color:present?"#15803d":"#dc2626"}}>
                              {present?<Check size={12}/>:<X size={12}/>}{present?"Present":"Absent"}
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

      {/* ════ LOCATION MODAL ════ */}
      <AnimatePresence>
        {locationModal && (
          <SupervisorLocationModal supervisor={locationModal} onClose={()=>setLocationModal(null)} />
        )}
      </AnimatePresence>

      {/* ════ SIDEBAR ════ */}
      <motion.aside style={A.sidebar} initial={{x:-60,opacity:0}} animate={{x:0,opacity:1}} transition={{duration:.4,ease:"easeOut"}}>
        <div style={A.sidebarTop}>
          <div style={A.logoMark}>
            <Activity size={16} color="#fff"/>
          </div>
          <div>
            <div style={A.logoTitle}>KrishiSetu</div>
            <div style={A.logoSub}>Admin Console</div>
          </div>
        </div>

        <nav style={{padding:"8px 10px",flex:1}}>
          {TABS.map((tab,i)=>{
            const Icon=tab.icon;
            const active=activeTab===tab.id;
            return(
              <motion.button key={tab.id}
                style={{
                  ...A.navBtn,
                  backgroundColor: active ? "#1b4332" : "transparent",
                  color: active ? "#fff" : "#64748b",
                }}
                onClick={()=>setActiveTab(tab.id)}
                whileHover={{x: active?0:2}} whileTap={{scale:.97}}
                initial={{opacity:0,x:-10}}
                animate={{opacity:1,x:0}}
                transition={{delay:i*0.04}}>
                <Icon size={14} color={active?"#52b788":"#94a3b8"} strokeWidth={active?2:1.5}/>
                <span style={{flex:1,textAlign:"left"}}>{tab.label}</span>
                {tab.badge>0&&<span style={A.redBadge}>{tab.badge}</span>}
                {active && <ChevronRight size={12} color="#52b788"/>}
              </motion.button>
            );
          })}
        </nav>

        <div style={{padding:"10px 10px 16px"}}>
          <div style={A.quickStat}>
            {[
              {val:allLabours.length, lbl:"Labours"},
              {val:supervisors.length, lbl:"Supervisors"},
              {val:liveB.length, lbl:"Live"},
            ].map((s,i)=>(
              <React.Fragment key={s.lbl}>
                {i>0&&<div style={{width:1,backgroundColor:"#e2e8f0"}}/>}
                <div style={{textAlign:"center",flex:1}}>
                  <div style={{fontSize:17,fontWeight:800,color:"#1b4332",lineHeight:1}}>{s.val}</div>
                  <div style={{fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginTop:2}}>{s.lbl}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
          <button style={A.logoutBtn} onClick={handleLogout}>
            <LogOut size={13} color="#ef4444"/>
            <span style={{color:"#ef4444",fontSize:13,fontWeight:600}}>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* ════ MAIN CONTENT ════ */}
      <main style={A.main}>
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW ── */}
          {activeTab==="overview"&&(
            <motion.div key="overview" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>Overview</h1>
                  <p style={A.pageSub}>Platform summary — {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:14}}>
                {[
                  {label:"Farmers",    value:farmers.length,    color:"#166534",bg:"#f0fdf4",border:"#bbf7d0",icon:User},
                  {label:"Supervisors",value:supervisors.length,color:"#1e40af",bg:"#eff6ff",border:"#bfdbfe",icon:Shield},
                  {label:"Labours",    value:allLabours.length, color:"#7c2d12",bg:"#fff7ed",border:"#fed7aa",icon:Users},
                  {label:"Active Jobs",value:liveB.length,      color:"#065f46",bg:"#ecfdf5",border:"#a7f3d0",icon:Activity},
                  {label:"Pending",    value:pendingB.length,   color:"#854d0e",bg:"#fefce8",border:"#fde047",icon:Clock},
                  {label:"Mismatches", value:mismatches.length, color:"#991b1b",bg:"#fef2f2",border:"#fecaca",icon:AlertTriangle},
                ].map((k,i)=>{
                  const Icon=k.icon;
                  return(
                    <motion.div key={k.label}
                      style={{backgroundColor:k.bg,border:`1px solid ${k.border}`,borderRadius:12,padding:"16px 14px",cursor:"default"}}
                      initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                      whileHover={{y:-2,boxShadow:"0 6px 20px rgba(0,0,0,.07)"}}>
                      <Icon size={16} color={k.color} strokeWidth={1.5} style={{marginBottom:10}}/>
                      <div style={{fontSize:24,fontWeight:800,color:k.color,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{k.value}</div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:5,fontWeight:500,letterSpacing:"0.01em"}}>{k.label}</div>
                    </motion.div>
                  );
                })}
              </div>

              <div style={A.revStrip}>
                {[
                  {lbl:"Revenue Collected",   val:"₹"+revenue.toLocaleString(),                        color:"#166534"},
                  {lbl:"Labour Cost / Month", val:"₹"+labSalary.toLocaleString(),                     color:"#dc2626"},
                  {lbl:"Supervisor Cost / Month",val:"₹"+supSalary.toLocaleString(),                  color:"#1d4ed8"},
                  {lbl:"Net Position",        val:"₹"+(revenue-labSalary-supSalary).toLocaleString(), color:revenue-labSalary-supSalary>=0?"#166534":"#dc2626"},
                ].map((r,i)=>(
                  <React.Fragment key={r.lbl}>
                    {i>0&&<div style={{width:1,backgroundColor:"#e2e8f0",margin:"0 20px"}}/>}
                    <div style={{flex:1,textAlign:"center"}}>
                      <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:0.7,marginBottom:5}}>{r.lbl}</div>
                      <div style={{fontSize:20,fontWeight:800,color:r.color,fontVariantNumeric:"tabular-nums"}}>{r.val}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {mismatches.length>0&&(
                <div style={{...A.section,border:"1px solid #fecaca",backgroundColor:"#fef2f2",marginBottom:12}}>
                  <div style={A.secHead}>
                    <AlertTriangle size={14} color="#dc2626"/>
                    <span style={{...A.secTitle,color:"#dc2626"}}>Attendance Mismatches ({mismatches.length})</span>
                  </div>
                  {mismatches.map(b=>(
                    <div key={b.id} style={{...A.tableRow,backgroundColor:"#fff",border:"1px solid #fecaca"}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{b.farmerName}</span>
                        <span style={{fontSize:12,color:"#94a3b8",marginLeft:8}}>{b.date}</span>
                        <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>
                          Farmer: <span style={{fontWeight:600,color:b.farmerConfirmed?"#16a34a":"#dc2626"}}>{b.farmerConfirmed?"Confirmed":"Pending"}</span>
                          {" · "}Supervisor: <span style={{fontWeight:600,color:b.supervisorConfirmed?"#16a34a":"#dc2626"}}>{b.supervisorConfirmed?"Confirmed":"Pending"}</span>
                        </div>
                      </div>
                      <button style={A.viewBtn} onClick={()=>setDetailModal({type:"booking",data:b})}><Eye size={12}/>View</button>
                    </div>
                  ))}
                </div>
              )}

              {holidaysToday.length>0&&(
                <div style={{...A.section,marginBottom:12}}>
                  <div style={A.secHead}><XCircle size={13} color="#c2410c"/><span style={A.secTitle}>On Leave Today</span></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {holidaysToday.map(l=>
                      Object.keys(l.unavailability||{}).filter(k=>k.startsWith(today)).map(key=>{
                        const[,s]=key.split("_");
                        return <span key={key} style={A.leaveChip}>{l.name} · {SLOT_CFG[s]?.label||s}</span>;
                      })
                    )}
                  </div>
                </div>
              )}

              <div style={A.section}>
                <div style={A.secHead}>
                  <div style={{width:7,height:7,borderRadius:"50%",backgroundColor:"#22c55e",boxShadow:"0 0 0 3px #dcfce7"}}/>
                  <span style={A.secTitle}>Active Bookings ({liveB.length})</span>
                </div>
                {liveB.length===0 ? <p style={A.emptyTxt}>No active bookings at this time.</p>
                  : liveB.slice(0,5).map(b=>(
                    <div key={b.id} style={A.tableRow}>
                      <div>
                        <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{b.farmerName}</span>
                        <span style={{fontSize:12,color:"#94a3b8",marginLeft:8}}>{b.date} · {SLOT_CFG[b.timeSlot]?.label} · {b.labourCount} labours</span>
                        <div style={{fontSize:12,color:"#64748b",marginTop:1}}>{b.supervisorName||"Unassigned"} · <span style={{fontWeight:600,color:"#1b4332"}}>₹{(b.totalCost||0).toLocaleString()}</span></div>
                      </div>
                      <button style={A.viewBtn} onClick={()=>setDetailModal({type:"booking",data:b})}><Eye size={12}/>View</button>
                    </div>
                  ))
                }
              </div>
            </motion.div>
          )}

          {/* ── BOOKINGS ── */}
          {activeTab==="bookings"&&(
            <motion.div key="bookings" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div><h1 style={A.pageTitle}>Bookings</h1><p style={A.pageSub}>{allBookings.length} total records</p></div>
              </div>

              <div style={{display:"flex",gap:8,marginBottom:18}}>
                {[
                  {id:"live",      label:"Active",    count:liveB.length,      color:"#166534", bg:"#f0fdf4", border:"#86efac"},
                  {id:"pending",   label:"Pending",   count:pendingB.length,   color:"#854d0e", bg:"#fefce8", border:"#fde047"},
                  {id:"completed", label:"Completed", count:completedB.length, color:"#1e40af", bg:"#eff6ff", border:"#93c5fd"},
                ].map(t=>{
                  const active=bookingTab===t.id;
                  return(
                    <motion.button key={t.id}
                      style={{
                        display:"flex", alignItems:"center", gap:8, padding:"9px 18px",
                        borderRadius:8, cursor:"pointer", fontSize:13, fontFamily:"inherit",
                        fontWeight: active?700:500,
                        backgroundColor: active ? t.bg : "#fff",
                        color: active ? t.color : "#64748b",
                        border: `1.5px solid ${active ? t.border : "#e2e8f0"}`,
                        transition:"all .18s",
                      }}
                      onClick={()=>setBookingTab(t.id)}
                      whileHover={{scale:1.02}} whileTap={{scale:.98}}>
                      {t.label}
                      <span style={{
                        padding:"1px 7px", borderRadius:5, fontSize:11, fontWeight:700,
                        backgroundColor: active ? t.color : "#e2e8f0",
                        color: active ? "#fff" : "#64748b",
                      }}>{t.count}</span>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={bookingTab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.18}}>
                  {bookTabData[bookingTab].length===0 ? (
                    <div style={{...A.section,textAlign:"center",padding:48}}>
                      <ClipboardList size={28} color="#d1d5db" style={{marginBottom:10}}/>
                      <p style={A.emptyTxt}>No {bookingTab} bookings found.</p>
                    </div>
                  ) : (
                    Object.entries(groupByDate(bookTabData[bookingTab])).map(([date, bList])=>(
                      <div key={date} style={{marginBottom:24}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",backgroundColor:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:9,marginBottom:10}}>
                          <Calendar size={13} color="#2d6a4f"/>
                          <span style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{date}</span>
                          <span style={{fontSize:12,color:"#94a3b8",fontWeight:500}}>{bList.length} booking{bList.length>1?"s":""}</span>
                          {date===today&&<span style={{marginLeft:"auto",backgroundColor:"#2d6a4f",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:5,letterSpacing:"0.04em"}}>TODAY</span>}
                        </div>

                        {["8-12","2-6","fullday"].map(slot=>{
                          const slotBookings=bList.filter(b=>b.timeSlot===slot);
                          if(!slotBookings.length) return null;
                          const sc=SLOT_CFG[slot];
                          const SlotIcon=sc.icon;
                          return(
                            <div key={slot} style={{marginBottom:10}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderLeft:`3px solid ${sc.color}`,marginBottom:8,backgroundColor:"#fafafa",borderRadius:"0 6px 6px 0"}}>
                                <SlotIcon size={12} color={sc.color}/>
                                <span style={{fontSize:12,fontWeight:700,color:sc.color}}>{sc.label}</span>
                                <span style={{fontSize:11,color:"#94a3b8"}}>{sc.time} · ₹{sc.rate}/labour</span>
                              </div>

                              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                {slotBookings.map(b=>{
                                  const ss=statusStyle(b.status);
                                  const mismatch=b.farmerConfirmed!==b.supervisorConfirmed&&(b.farmerConfirmed||b.supervisorConfirmed);
                                  const presentCount=Object.values(b.labourAttendance||{}).filter(Boolean).length;
                                  return(
                                    <motion.div key={b.id}
                                      style={{
                                        borderRadius:10, padding:16,
                                        border:`1px solid ${mismatch?"#fca5a5":"#e2e8f0"}`,
                                        backgroundColor: mismatch?"#fef2f2":"#fff",
                                        boxShadow:"0 1px 4px rgba(0,0,0,.04)",
                                      }}
                                      whileHover={{y:-1,boxShadow:"0 4px 16px rgba(0,0,0,.07)"}}>

                                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                                          <span style={{...A.statusBadge,backgroundColor:ss.bg,color:ss.color,border:`1px solid ${ss.border}`}}>{b.status}</span>
                                          {mismatch&&<span style={{...A.statusBadge,backgroundColor:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5"}}>Mismatch</span>}
                                          {b.bookedByAdmin&&<span style={{...A.statusBadge,backgroundColor:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe"}}>Admin</span>}
                                          {b.supervisorVisitedFarm===true&&<span style={{...A.statusBadge,backgroundColor:"#f0fdf4",color:"#15803d",border:"1px solid #bbf7d0"}}>Farm Visited</span>}
                                          {b.supervisorVisitedFarm===false&&b.supervisorVisitedAt&&<span style={{...A.statusBadge,backgroundColor:"#fffbeb",color:"#92400e",border:"1px solid #fde68a"}}>Remote Confirm</span>}
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                                          <span style={{fontWeight:800,fontSize:15,color:"#1b4332",fontVariantNumeric:"tabular-nums"}}>₹{(b.totalCost||0).toLocaleString()}</span>
                                          <motion.button style={A.viewBtn} onClick={()=>setDetailModal({type:"booking",data:b})} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Eye size={12}/>View</motion.button>
                                        </div>
                                      </div>

                                      <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr 1px 1fr",gap:0}}>
                                        <div style={{paddingRight:16}}>
                                          <div style={A.colHead}>Farmer</div>
                                          <div style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{b.farmerName}</div>
                                          <div style={{fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",gap:3,marginTop:2}}><Phone size={9}/>{b.farmerPhone}</div>
                                          <div style={{fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",gap:3,marginTop:1}}><MapPin size={9}/>{b.farmAddress||b.village}</div>
                                          {b.workType&&<div style={{fontSize:11,color:"#64748b",marginTop:1}}>{b.workType}</div>}
                                          {b.farmLat&&b.farmLng&&(
                                            <a href={`https://www.google.com/maps?q=${b.farmLat},${b.farmLng}`} target="_blank" rel="noreferrer"
                                              style={{display:"inline-flex",alignItems:"center",gap:3,marginTop:6,fontSize:11,color:"#2d6a4f",fontWeight:600,textDecoration:"none"}}>
                                              <MapPin size={9}/>Farm Location
                                            </a>
                                          )}
                                        </div>

                                        <div style={{backgroundColor:"#e2e8f0"}}/>

                                        <div style={{padding:"0 16px"}}>
                                          <div style={A.colHead}>Supervisor</div>
                                          {b.supervisorName ? (
                                            <>
                                              <div style={{fontWeight:700,fontSize:13,color:"#774936"}}>{b.supervisorName}</div>
                                              <div style={{fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",gap:3,marginTop:2}}><Phone size={9}/>{b.supervisorPhone}</div>
                                            </>
                                          ):<div style={{fontSize:12,color:"#f59e0b",fontWeight:600}}>Unassigned</div>}
                                          <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>
                                            Confirmed: <span style={{fontWeight:600,color:b.supervisorConfirmed?"#16a34a":"#94a3b8"}}>{b.supervisorConfirmed?"Yes":"No"}</span>
                                          </div>
                                          {b.supervisorId&&(()=>{
                                            const supUser=allUsers.find(u=>u.id===b.supervisorId);
                                            if(supUser?.supervisorLat&&supUser?.supervisorLng){
                                              return(
                                                <a href={`https://www.google.com/maps?q=${supUser.supervisorLat},${supUser.supervisorLng}`}
                                                  target="_blank" rel="noreferrer"
                                                  style={{display:"inline-flex",alignItems:"center",gap:3,marginTop:6,fontSize:11,color:"#1d4ed8",fontWeight:600,textDecoration:"none"}}>
                                                  <Navigation size={9}/>Live Location
                                                </a>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>

                                        <div style={{backgroundColor:"#e2e8f0"}}/>

                                        <div style={{paddingLeft:16}}>
                                          <div style={A.colHead}>Labour ({b.assignedLabour||0}/{b.labourCount})</div>
                                          {b.assignedLabourNames?.length>0 ? (
                                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                              {b.assignedLabourNames.map((name,idx)=>{
                                                const lid=b.assignedLabourIds?.[idx];
                                                const present=b.labourAttendance?.[lid]===true;
                                                return(
                                                  <span key={idx} style={{
                                                    fontSize:11,padding:"2px 7px",borderRadius:5,fontWeight:600,
                                                    backgroundColor:present?"#f0fdf4":"#f8fafc",
                                                    color:present?"#15803d":"#64748b",
                                                    border:`1px solid ${present?"#bbf7d0":"#e2e8f0"}`}}>
                                                    {name}
                                                  </span>
                                                );
                                              })}
                                              <div style={{fontSize:11,color:"#94a3b8",width:"100%",marginTop:3}}>
                                                {presentCount}/{b.assignedLabour||0} present · Farmer: <span style={{fontWeight:600,color:b.farmerConfirmed?"#16a34a":"#94a3b8"}}>{b.farmerConfirmed?"Confirmed":"Pending"}</span>
                                              </div>
                                            </div>
                                          ):<span style={{fontSize:12,color:"#94a3b8"}}>None assigned</span>}
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── NEW BOOKING ── */}
          {activeTab==="book"&&(
            <motion.div key="book" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div><h1 style={A.pageTitle}>New Booking</h1><p style={A.pageSub}>Create and assign a booking directly on behalf of a farmer</p></div>
              </div>
              <div style={A.formCard}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  {[
                    {lbl:"Farmer", node:(
                      <select style={A.inp} value={bFarmerId} onChange={e=>setBFarmerId(e.target.value)}>
                        <option value="">Select farmer…</option>
                        {farmers.map(f=><option key={f.id} value={f.id}>{f.name} · {f.phone}</option>)}
                      </select>
                    )},
                    {lbl:"Supervisor", node:(
                      <select style={A.inp} value={bSupervisorId} onChange={e=>{setBSupervisorId(e.target.value);setBSelectedLabours([]);}}>
                        <option value="">Select supervisor…</option>
                        {supervisors.map(s=><option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
                      </select>
                    )},
                    {lbl:"Date", node:(
                      <input style={A.inp} type="date" value={bDate} onChange={e=>{setBDate(e.target.value);setBSelectedLabours([]);}} min={today}/>
                    )},
                    {lbl:"Work Type", node:(
                      <select style={A.inp} value={bWorkType} onChange={e=>setBWorkType(e.target.value)}>
                        {WORK_TYPES.map(w=><option key={w}>{w}</option>)}
                      </select>
                    )},
                    {lbl:"Farm Address", node:(
                      <input style={A.inp} type="text" placeholder="Full address" value={bAddress} onChange={e=>setBAddress(e.target.value)}/>
                    )},
                    {lbl:"Landmark", node:(
                      <input style={A.inp} type="text" placeholder="Nearby landmark" value={bLandmark} onChange={e=>setBLandmark(e.target.value)}/>
                    )},
                  ].map(f=>(
                    <div key={f.lbl}>
                      <label style={A.label}>{f.lbl}</label>
                      {f.node}
                    </div>
                  ))}
                </div>

                <div style={{marginTop:18}}>
                  <label style={A.label}>Time Slot</label>
                  <div style={{display:"flex",gap:8,marginTop:6}}>
                    {Object.entries(SLOT_CFG).map(([key,cfg])=>{
                      const Icon=cfg.icon;
                      const sel=bSlot===key;
                      return(
                        <motion.button key={key} type="button"
                          style={{
                            display:"flex",alignItems:"center",gap:6,padding:"10px 16px",
                            borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:sel?700:500,fontFamily:"inherit",
                            backgroundColor:sel?cfg.color:"#fff",
                            color:sel?"#fff":"#64748b",
                            border:`1.5px solid ${sel?cfg.color:"#e2e8f0"}`,
                          }}
                          onClick={()=>{setBSlot(key);setBSelectedLabours([]);}}
                          whileHover={{scale:1.02}} whileTap={{scale:.97}}>
                          <Icon size={13}/>{cfg.label}
                          <span style={{fontSize:11,opacity:0.75}}>₹{cfg.rate}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {bDate&&bSupervisorId&&(
                  <div style={{marginTop:20}}>
                    <label style={A.label}>
                      Available Labour — {availNow.length} found for selected date & slot
                    </label>
                    {availNow.length===0 ? (
                      <div style={{backgroundColor:"#fefce8",border:"1px solid #fde047",borderRadius:8,padding:"11px 14px",fontSize:13,color:"#854d0e",fontWeight:500,marginTop:8}}>
                        No labours available for this supervisor on the selected date and slot.
                      </div>
                    ) : (
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginTop:8}}>
                        {availNow.map(l=>{
                          const sel=bSelectedLabours.includes(l.id);
                          return(
                            <motion.div key={l.id}
                              style={{
                                display:"flex",justifyContent:"space-between",alignItems:"center",
                                padding:"10px 12px",borderRadius:9,cursor:"pointer",
                                backgroundColor:sel?"#f0fdf4":"#fff",
                                border:`1.5px solid ${sel?"#2d6a4f":"#e2e8f0"}`,
                              }}
                              onClick={()=>setBSelectedLabours(prev=>prev.includes(l.id)?prev.filter(x=>x!==l.id):[...prev,l.id])}
                              whileHover={{scale:1.02}} whileTap={{scale:.97}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:7,height:7,borderRadius:"50%",backgroundColor:sel?"#2d6a4f":"#d1d5db",flexShrink:0}}/>
                                <div>
                                  <p style={{margin:0,fontSize:13,fontWeight:600,color:"#0f172a"}}>{l.name}</p>
                                  <p style={{margin:0,fontSize:11,color:"#94a3b8"}}>{l.phone}</p>
                                </div>
                              </div>
                              {sel&&<Check size={14} color="#2d6a4f" strokeWidth={2.5}/>}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {bSelectedLabours.length>0&&(
                  <div style={{backgroundColor:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,padding:"12px 16px",marginTop:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:13,color:"#5c7a6b",fontWeight:500}}>{bSelectedLabours.length} labour{bSelectedLabours.length>1?"s":""} × ₹{SLOT_CFG[bSlot]?.rate}</span>
                    <span style={{fontSize:20,fontWeight:800,color:"#1b4332",fontVariantNumeric:"tabular-nums"}}>₹{(bSelectedLabours.length*(SLOT_CFG[bSlot]?.rate||300)).toLocaleString()}</span>
                  </div>
                )}

                <motion.button style={{...A.primaryBtn,marginTop:20,padding:"12px 24px",fontSize:14,opacity:loading?.6:1}}
                  onClick={handleAdminBook} disabled={loading}
                  whileHover={{scale:1.01}} whileTap={{scale:.98}}>
                  {loading ? <><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>Creating…</> : "Create & Assign Booking"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── SUPERVISORS ── */}
          {activeTab==="supervisors"&&(
            <motion.div key="supervisors" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div><h1 style={A.pageTitle}>Supervisors</h1><p style={A.pageSub}>{supervisors.length} registered</p></div>
                <motion.button style={A.primaryBtn} onClick={()=>setAddSupModal(true)} whileHover={{scale:1.02}} whileTap={{scale:.97}}>
                  <UserPlus size={14}/>Add Supervisor
                </motion.button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {supervisors.map((sup,i)=>{
                  const supLabs=allLabours.filter(l=>l.supervisorId===sup.id);
                  const supJobs=allBookings.filter(b=>b.supervisorId===sup.id&&b.status==="assigned");
                  const onLeave=supLabs.filter(l=>Object.keys(l.unavailability||{}).some(k=>k.startsWith(today)));
                  const isSharing=!!(sup.supervisorLat&&sup.supervisorLng);
                  return(
                    <motion.div key={sup.id} style={A.personCard}
                      initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                      whileHover={{boxShadow:"0 4px 18px rgba(27,67,50,.08)"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:14,flex:1}}>
                        <div style={{...A.avatar,backgroundColor:"#eff6ff",color:"#1d4ed8",border:"1.5px solid #bfdbfe",fontSize:15,fontWeight:800}}>{sup.name?.[0]?.toUpperCase()}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                            <span style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{sup.name}</span>
                            <span style={{...A.statusBadge,backgroundColor:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe"}}>Supervisor</span>
                            {isSharing&&<span style={{...A.statusBadge,backgroundColor:"#f0fdf4",color:"#15803d",border:"1px solid #bbf7d0"}}>Sharing Location</span>}
                          </div>
                          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:10}}>
                            <span style={A.metaItem}><Phone size={11} color="#94a3b8"/>{sup.phone}</span>
                            <span style={A.metaItem}><Users size={11} color="#94a3b8"/>{supLabs.length} labours</span>
                            <span style={A.metaItem}><Activity size={11} color="#94a3b8"/>{supJobs.length} active jobs</span>
                            {onLeave.length>0&&<span style={{...A.metaItem,color:"#dc2626"}}><XCircle size={11}/>{onLeave.length} on leave today</span>}
                          </div>
                          {supLabs.length>0&&(
                            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                              {supLabs.map(l=>{
                                const busy=allBookings.some(b=>b.status==="assigned"&&b.date===today&&b.assignedLabourIds?.includes(l.id));
                                const onLve=Object.keys(l.unavailability||{}).some(k=>k.startsWith(today));
                                return(
                                  <span key={l.id}
                                    style={{
                                      fontSize:11,padding:"2px 8px",borderRadius:5,fontWeight:500,cursor:"pointer",
                                      backgroundColor:onLve?"#fef2f2":busy?"#fefce8":"#f0fdf4",
                                      color:onLve?"#dc2626":busy?"#854d0e":"#15803d",
                                      border:`1px solid ${onLve?"#fecaca":busy?"#fde047":"#bbf7d0"}`,
                                    }}
                                    onClick={()=>setDetailModal({type:"labour",data:l})}>
                                    {l.name}
                                    <span style={{marginLeft:4,opacity:0.6}}>{onLve?"·Leave":busy?"·Busy":""}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,flexShrink:0}}>
                        <motion.button
                          style={{
                            ...A.viewBtn,
                            backgroundColor:isSharing?"#eff6ff":"#f8fafc",
                            color:isSharing?"#1d4ed8":"#94a3b8",
                            border:`1px solid ${isSharing?"#bfdbfe":"#e2e8f0"}`,
                          }}
                          onClick={()=>setLocationModal(sup)}
                          whileHover={{scale:1.04}} whileTap={{scale:.96}}>
                          <Navigation size={12}/>Track
                        </motion.button>
                        <motion.button style={A.viewBtn} onClick={()=>setDetailModal({type:"supervisor",data:sup})} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Eye size={12}/>Details</motion.button>
                        <motion.button style={A.delBtn} onClick={()=>delSupervisor(sup.id,sup.name)} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Trash2 size={13}/></motion.button>
                      </div>
                    </motion.div>
                  );
                })}
                {supervisors.length===0&&<div style={{...A.section,textAlign:"center",padding:48}}><p style={A.emptyTxt}>No supervisors registered yet.</p></div>}
              </div>
            </motion.div>
          )}

          {/* ── LABOURS ── */}
          {activeTab==="labours"&&(
            <motion.div key="labours" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div>
                  <h1 style={A.pageTitle}>All Labours</h1>
                  <p style={A.pageSub}>{allLabours.length} total · {allLabours.filter(l=>!Object.keys(l.unavailability||{}).some(k=>k.startsWith(today))).length} available today</p>
                </div>
                <motion.button style={A.primaryBtn} onClick={()=>setAddLabourModal(true)} whileHover={{scale:1.02}}><Plus size={14}/>Add Labour</motion.button>
              </div>
              {supervisors.map(sup=>{
                const supLabs=allLabours.filter(l=>l.supervisorId===sup.id);
                if(!supLabs.length) return null;
                return(
                  <div key={sup.id} style={{...A.section,marginBottom:12}}>
                    <div style={A.secHead}>
                      <div style={{...A.avatar,width:26,height:26,fontSize:11,fontWeight:700,backgroundColor:"#eff6ff",color:"#1d4ed8",border:"1.5px solid #bfdbfe"}}>{sup.name[0]}</div>
                      <span style={A.secTitle}>{sup.name}'s Team · {supLabs.length} labours</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {supLabs.map(l=>{
                        const busy=allBookings.some(b=>b.status==="assigned"&&b.date===today&&b.assignedLabourIds?.includes(l.id));
                        const leaveKeys=Object.keys(l.unavailability||{}).filter(k=>k.startsWith(today));
                        return(
                          <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",backgroundColor:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                              <div style={{...A.avatar,width:30,height:30,fontSize:11,fontWeight:700,backgroundColor:"#fff",border:"1.5px solid #e2e8f0",color:"#64748b"}}>{l.name[0]}</div>
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{l.name}</span>
                                  {busy&&<span style={{...A.statusBadge,backgroundColor:"#fefce8",color:"#854d0e",border:"1px solid #fde047"}}>Assigned Today</span>}
                                  {leaveKeys.length>0&&<span style={{...A.statusBadge,backgroundColor:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca"}}>On Leave</span>}
                                </div>
                                <div style={{display:"flex",gap:10,marginTop:2,alignItems:"center"}}>
                                  <span style={{...A.metaItem,fontSize:11}}><Phone size={10}/>{l.phone}</span>
                                  {leaveKeys.map(key=>{const[,s]=key.split("_");return<span key={key} style={{fontSize:10,color:"#dc2626",fontWeight:500}}>{SLOT_CFG[s]?.label}</span>;})}
                                </div>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <motion.button style={A.viewBtn} onClick={()=>setDetailModal({type:"labour",data:l})} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Eye size={12}/>Details</motion.button>
                              <motion.button style={A.delBtn} onClick={()=>delLabour(l.id,l.name)} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Trash2 size={13}/></motion.button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {allLabours.length===0&&<div style={{...A.section,textAlign:"center",padding:48}}><p style={A.emptyTxt}>No labours added yet.</p></div>}
            </motion.div>
          )}

          {/* ── FARMERS ── */}
          {activeTab==="farmers"&&(
            <motion.div key="farmers" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div><h1 style={A.pageTitle}>Farmers</h1><p style={A.pageSub}>{farmers.length} registered accounts</p></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {farmers.map((f,i)=>{
                  const fBooks=allBookings.filter(b=>b.farmerId===f.id);
                  const spent=fBooks.reduce((s,b)=>s+(b.totalCost||0),0);
                  return(
                    <motion.div key={f.id} style={A.personCard}
                      initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                      whileHover={{boxShadow:"0 4px 18px rgba(27,67,50,.08)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:14,flex:1}}>
                        <div style={{...A.avatar,backgroundColor:"#f0fdf4",color:"#15803d",border:"1.5px solid #bbf7d0",fontSize:15,fontWeight:800}}>{f.name?.[0]?.toUpperCase()}</div>
                        <div style={{flex:1}}>
                          <span style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{f.name}</span>
                          <div style={{display:"flex",gap:16,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                            <span style={A.metaItem}><Phone size={11} color="#94a3b8"/>{f.phone}</span>
                            <span style={A.metaItem}><MapPin size={11} color="#94a3b8"/>{f.village}</span>
                            <span style={A.metaItem}><ClipboardList size={11} color="#94a3b8"/>{fBooks.length} bookings</span>
                            <span style={{...A.metaItem,color:"#166534",fontWeight:600}}>₹{spent.toLocaleString()} spent</span>
                            {f.cropType&&<span style={A.metaItem}>{Array.isArray(f.cropType)?f.cropType.join(", "):f.cropType}</span>}
                          </div>
                        </div>
                      </div>
                      <motion.button style={A.viewBtn} onClick={()=>setDetailModal({type:"farmer",data:f})} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Eye size={12}/>Details</motion.button>
                    </motion.div>
                  );
                })}
                {farmers.length===0&&<div style={{...A.section,textAlign:"center",padding:48}}><p style={A.emptyTxt}>No farmers registered yet.</p></div>}
              </div>
            </motion.div>
          )}

          {/* ── FINANCE ── */}
          {activeTab==="finance"&&(
            <motion.div key="finance" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
              <div style={A.pageHeader}>
                <div><h1 style={A.pageTitle}>Finance</h1><p style={A.pageSub}>Revenue, costs and profitability</p></div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
                {[
                  {lbl:"Revenue from Bookings",    val:revenue,   color:"#166534",bg:"#f0fdf4",border:"#bbf7d0",icon:TrendingUp},
                  {lbl:"Labour Costs / Month",     val:labSalary, color:"#dc2626",bg:"#fef2f2",border:"#fecaca",icon:Users},
                  {lbl:"Supervisor Costs / Month", val:supSalary, color:"#1d4ed8",bg:"#eff6ff",border:"#bfdbfe",icon:Shield},
                ].map((c,i)=>{
                  const Icon=c.icon;
                  return(
                    <motion.div key={c.lbl}
                      style={{backgroundColor:c.bg,border:`1px solid ${c.border}`,borderRadius:12,padding:22}}
                      initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
                      whileHover={{y:-2,boxShadow:"0 6px 18px rgba(0,0,0,.07)"}}>
                      <Icon size={16} color={c.color} strokeWidth={1.5} style={{marginBottom:12}}/>
                      <div style={{fontSize:26,fontWeight:800,color:c.color,fontVariantNumeric:"tabular-nums"}}>₹{c.val.toLocaleString()}</div>
                      <div style={{fontSize:12,color:"#6b7280",marginTop:5,fontWeight:500}}>{c.lbl}</div>
                    </motion.div>
                  );
                })}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
                {[
                  {title:"Bookings by Status",slices:[
                    {label:"Active",   value:liveB.length,      color:"#2d6a4f"},
                    {label:"Pending",  value:pendingB.length,   color:"#f59e0b"},
                    {label:"Complete", value:completedB.length, color:"#6366f1"},
                  ]},
                  {title:"Workforce Distribution",slices:[
                    {label:"Labours",     value:allLabours.length,  color:"#52b788"},
                    {label:"Supervisors", value:supervisors.length, color:"#774936"},
                    {label:"Farmers",     value:farmers.length,     color:"#f59e0b"},
                  ]},
                ].map(chart=>(
                  <div key={chart.title} style={{...A.section,display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                    <span style={A.secTitle}>{chart.title}</span>
                    <PieChart size={140} slices={chart.slices}/>
                    <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center"}}>
                      {chart.slices.map(s=>(
                        <div key={s.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:s.color}}/>
                          <span style={{color:"#64748b",fontWeight:500}}>{s.label}: <strong style={{color:"#0f172a"}}>{s.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{...A.section,gridColumn:"1/-1",overflowX:"auto"}}>
                  <span style={A.secTitle}>Revenue per Farmer</span>
                  <div style={{marginTop:14,overflowX:"auto"}}>
                    {farmers.length>0
                      ?<BarChart color="#2d6a4f" height={90} data={farmers.map(f=>({
                          label: f.name?.split(" ")[0]||"?",
                          value: allBookings.filter(b=>b.farmerId===f.id&&b.status!=="pending").reduce((s,b)=>s+(b.totalCost||0),0),
                        }))}/>
                      :<p style={A.emptyTxt}>No data available.</p>
                    }
                  </div>
                </div>
              </div>

              <div style={{...A.section,marginBottom:16}}>
                <div style={A.secHead}><TrendingUp size={14} color="#2d6a4f"/><span style={A.secTitle}>Cost Breakdown</span></div>
                {[
                  [`${allLabours.length} Labours × ₹${LABOUR_MONTHLY.toLocaleString()}/month`, labSalary, "#374151", false],
                  [`${supervisors.length} Supervisors × ₹${SUP_MONTHLY.toLocaleString()}/month`, supSalary, "#374151", false],
                  ["Total Monthly Expenses", labSalary+supSalary, "#374151", true],
                  ["Revenue Collected", revenue, "#166534", true],
                  ["Net Position", revenue-labSalary-supSalary, revenue-labSalary-supSalary>=0?"#166534":"#dc2626", true],
                ].map(([k,v,c,bold])=>(
                  <div key={k} style={{
                    ...A.tableRow,
                    backgroundColor:bold?"#f8fafc":"#fff",
                    borderTop: bold ? "1px solid #e2e8f0" : "none",
                    fontWeight:bold?700:400,
                  }}>
                    <span style={{fontSize:13,color:"#374151"}}>{k}</span>
                    <span style={{fontSize:bold?16:14,fontWeight:700,color:c,fontVariantNumeric:"tabular-nums"}}>₹{v.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {[
                  {title:"Supervisors",icon:Shield,color:"#774936",list:supervisors,addFn:()=>setAddSupModal(true),delFn:delSupervisor,
                   sub:(s)=>`${s.phone} · ${allLabours.filter(l=>l.supervisorId===s.id).length} labours · ₹${SUP_MONTHLY.toLocaleString()}/mo`},
                  {title:"Labours",icon:Users,color:"#2d6a4f",list:allLabours,addFn:()=>setAddLabourModal(true),delFn:delLabour,
                   sub:(l)=>`${l.phone} · ${l.supervisorName} · ₹${LABOUR_MONTHLY.toLocaleString()}/mo`},
                ].map(panel=>{
                  const Icon=panel.icon;
                  return(
                    <div key={panel.title} style={A.section}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={A.secHead}><Icon size={13} color={panel.color}/><span style={A.secTitle}>{panel.title}</span></div>
                        <motion.button style={{...A.primaryBtn,padding:"6px 12px",fontSize:12}} onClick={panel.addFn} whileHover={{scale:1.02}}><Plus size={12}/>Add</motion.button>
                      </div>
                      {panel.list.map(item=>(
                        <div key={item.id} style={{...A.tableRow,justifyContent:"space-between"}}>
                          <div>
                            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#0f172a"}}>{item.name}</p>
                            <p style={{margin:0,fontSize:11,color:"#94a3b8"}}>{panel.sub(item)}</p>
                          </div>
                          <motion.button style={A.delBtn} onClick={()=>panel.delFn(item.id,item.name)} whileHover={{scale:1.04}} whileTap={{scale:.96}}><Trash2 size={13}/></motion.button>
                        </div>
                      ))}
                      {panel.list.length===0&&<p style={A.emptyTxt}>None added yet.</p>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────── */
const A = {
  root: {
    minHeight:"100vh", backgroundColor:"#f8fafc",
    display:"flex", fontFamily:"'DM Sans', 'Segoe UI', sans-serif",
    color:"#0f172a",
  },
  overlay: {
    position:"fixed", inset:0, backgroundColor:"rgba(15,23,42,.45)",
    display:"flex", alignItems:"center", justifyContent:"center",
    zIndex:1000, padding:20, backdropFilter:"blur(4px)",
  },
  modal: {
    backgroundColor:"#fff", border:"1px solid #e2e8f0", borderRadius:14,
    padding:28, width:"100%", maxWidth:420,
    boxShadow:"0 20px 60px rgba(0,0,0,.14)", maxHeight:"90vh", overflowY:"auto",
  },
  modalHeader: {
    display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20,
  },
  modalTitle: { fontSize:17, fontWeight:700, color:"#0f172a", margin:0 },
  iconClose: {
    width:30, height:30, border:"1px solid #e2e8f0", borderRadius:7, cursor:"pointer",
    backgroundColor:"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center",
    color:"#64748b", padding:0,
  },
  label: {
    display:"block", fontSize:11, fontWeight:600, color:"#64748b",
    textTransform:"uppercase", letterSpacing:0.6, marginBottom:6,
  },
  inp: {
    width:"100%", padding:"10px 13px", backgroundColor:"#f8fafc",
    border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13,
    color:"#0f172a", boxSizing:"border-box", outline:"none",
    fontFamily:"'DM Sans', sans-serif", transition:"border-color .15s",
  },
  primaryBtn: {
    display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px",
    background:"linear-gradient(135deg,#2d6a4f,#1b4332)", border:"none",
    borderRadius:9, color:"#fff", fontSize:13, fontWeight:600,
    cursor:"pointer", fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.01em",
    boxShadow:"0 2px 8px rgba(45,106,79,.25)",
  },
  ghostBtn: {
    padding:"10px 16px", backgroundColor:"#f8fafc", border:"1px solid #e2e8f0",
    borderRadius:9, color:"#64748b", fontSize:13, fontWeight:500,
    cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
  },
  dRow: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"8px 0", borderBottom:"1px solid #f1f5f9",
  },
  dKey: { fontSize:11, fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.4 },
  dVal: { fontSize:13, fontWeight:500, color:"#0f172a" },
  mapLink: {
    display:"inline-flex", alignItems:"center", gap:5, padding:"8px 13px",
    backgroundColor:"#f8fafc", border:"1px solid #e2e8f0",
    borderRadius:7, color:"#1d4ed8", fontSize:12, fontWeight:600, textDecoration:"none",
  },
  avatarSm: {
    width:34, height:34, borderRadius:"50%", display:"flex",
    alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, flexShrink:0,
  },

  sidebar: {
    width:220, minHeight:"100vh", backgroundColor:"#fff",
    borderRight:"1px solid #e2e8f0", display:"flex", flexDirection:"column",
    position:"sticky", top:0, height:"100vh", overflowY:"auto",
    flexShrink:0, boxShadow:"1px 0 0 #e2e8f0",
  },
  sidebarTop: {
    display:"flex", alignItems:"center", gap:11, padding:"20px 16px 18px",
    borderBottom:"1px solid #f1f5f9",
  },
  logoMark: {
    width:34, height:34, borderRadius:9,
    background:"linear-gradient(135deg,#2d6a4f,#1b4332)",
    display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 3px 10px rgba(45,106,79,.3)", flexShrink:0,
  },
  logoTitle: { fontSize:14, fontWeight:700, color:"#0f172a", letterSpacing:"-0.02em" },
  logoSub: { fontSize:10, color:"#94a3b8", fontWeight:500, letterSpacing:"0.02em" },
  navBtn: {
    width:"100%", display:"flex", alignItems:"center", gap:9,
    padding:"9px 12px", borderRadius:8, border:"none",
    cursor:"pointer", fontSize:13, fontWeight:500,
    fontFamily:"'DM Sans', sans-serif", marginBottom:1,
    transition:"background .15s, color .15s",
  },
  redBadge: {
    marginLeft:"auto", backgroundColor:"#fef2f2", color:"#dc2626",
    border:"1px solid #fecaca", fontSize:10, fontWeight:700,
    padding:"1px 6px", borderRadius:5,
  },
  quickStat: {
    display:"flex", justifyContent:"space-around", alignItems:"center",
    backgroundColor:"#f8fafc", border:"1px solid #e2e8f0",
    borderRadius:10, padding:"12px 8px", marginBottom:8,
  },
  logoutBtn: {
    display:"flex", alignItems:"center", gap:8, padding:"9px 14px",
    backgroundColor:"#fff8f8", border:"1px solid #fee2e2",
    borderRadius:8, cursor:"pointer", width:"100%",
    fontFamily:"'DM Sans', sans-serif", transition:"background .15s",
  },

  main: { flex:1, padding:"28px 32px", overflowY:"auto", minHeight:"100vh" },
  pageHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  pageTitle: { fontSize:22, fontWeight:800, color:"#0f172a", margin:0, letterSpacing:"-0.04em" },
  pageSub: { fontSize:13, color:"#64748b", margin:"3px 0 0", fontWeight:400 },

  section: {
    backgroundColor:"#fff", border:"1px solid #e2e8f0",
    borderRadius:12, padding:18, boxShadow:"0 1px 3px rgba(0,0,0,.04)",
  },
  secHead: { display:"flex", alignItems:"center", gap:8, marginBottom:14 },
  secTitle: { fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:0.6 },
  tableRow: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"10px 12px", borderRadius:8, marginBottom:5, border:"1px solid #f1f5f9",
  },
  emptyTxt: { color:"#94a3b8", fontSize:13, textAlign:"center", padding:"16px 0", margin:0, fontWeight:400 },
  leaveChip: {
    backgroundColor:"#fef2f2", border:"1px solid #fecaca",
    color:"#dc2626", fontSize:12, fontWeight:500,
    padding:"3px 10px", borderRadius:5,
  },
  revStrip: {
    backgroundColor:"#fff", border:"1px solid #e2e8f0",
    borderRadius:12, padding:"18px 24px", display:"flex",
    marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,.04)",
  },

  statusBadge: {
    display:"inline-flex", alignItems:"center", padding:"2px 8px",
    borderRadius:5, fontSize:11, fontWeight:600, letterSpacing:"0.01em",
  },
  viewBtn: {
    display:"inline-flex", alignItems:"center", gap:4, padding:"6px 11px",
    backgroundColor:"#f8fafc", border:"1px solid #e2e8f0",
    borderRadius:7, fontSize:12, fontWeight:600, color:"#374151",
    cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
  },
  delBtn: {
    padding:"6px 9px", backgroundColor:"#fff8f8",
    border:"1px solid #fee2e2", borderRadius:7,
    color:"#ef4444", cursor:"pointer",
    display:"flex", alignItems:"center", fontFamily:"'DM Sans', sans-serif",
  },
  personCard: {
    backgroundColor:"#fff", border:"1px solid #e2e8f0", borderRadius:12,
    padding:"16px 18px", display:"flex", alignItems:"flex-start",
    justifyContent:"space-between", gap:12,
    boxShadow:"0 1px 3px rgba(0,0,0,.04)", transition:"box-shadow .2s",
  },
  avatar: {
    width:40, height:40, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    flexShrink:0,
  },
  metaItem: {
    display:"flex", alignItems:"center", gap:4,
    fontSize:12, color:"#94a3b8", fontWeight:400,
  },
  colHead: {
    fontSize:10, fontWeight:700, color:"#94a3b8",
    textTransform:"uppercase", letterSpacing:0.6, marginBottom:5,
  },
  formCard: {
    backgroundColor:"#fff", border:"1px solid #e2e8f0",
    borderRadius:14, padding:26, boxShadow:"0 1px 4px rgba(0,0,0,.05)",
  },
};