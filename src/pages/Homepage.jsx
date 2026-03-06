import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID  = "service_qfo1ya9";
const EMAILJS_TEMPLATE_ID = "template_g7oumhn";
const EMAILJS_PUBLIC_KEY  = "IUo8yDTPalsNOllKr";


const NAV_LINKS = ["Home", "How It Works", "About", "Contact"];

const FEATURES = [
    { icon: "🌍", title: "Farm Location Mapping", desc: "Farmers can pin their exact farm location using an interactive map for precise labour dispatch." },
    { icon: "👥", title: "Labour Availability Tracking", desc: "Supervisors update labour availability every night so farmers see real-time counts before booking." },
    { icon: "📅", title: "Smart Time Slots", desc: "Book labour for Morning (8–12), Afternoon (2–6), or Full Day based on your harvest needs." },
    { icon: "📍", title: "Live Supervisor Location", desc: "Admins can track supervisor GPS location in real time directly from the dashboard." },
    { icon: "✅", title: "Attendance Verification", desc: "Both farmer and supervisor confirm work completion for full transparency and accountability." },
    { icon: "⚠️", title: "Mismatch Detection", desc: "Admin receives an instant alert whenever farmer and supervisor attendance records don't match." },
];

const ROLES = [
    {
        icon: "🚜",
        title: "Farmer",
        color: "#2d6a4f",
        bg: "#d8f3dc",
        border: "#b7e4c7",
        points: [
            "Request labour instantly",
            "Select work time slots",
            "Pin farm location on map",
            "Confirm attendance",
        ],
    },
    {
        icon: "👨‍🌾",
        title: "Supervisor",
        color: "#774936",
        bg: "#fde8d8",
        border: "#f4c0a0",
        points: [
            "Manage labour teams",
            "Assign workers to farms",
            "Track farm locations",
            "Mark attendance",
        ],
    },
    {
        icon: "📊",
        title: "Admin",
        color: "#1b4332",
        bg: "#e9f5ec",
        border: "#b7e4c7",
        points: [
            "Monitor supervisors",
            "Track labour allocation",
            "Detect attendance mismatch",
            "View live supervisor location",
        ],
    },
];

const STEPS = [
    { num: "01", icon: "📝", title: "Farmer Requests Labour", desc: "Farmer logs in, selects time slot, enters labour count, and pins farm location." },
    { num: "02", icon: "📩", title: "Supervisor Receives Request", desc: "Supervisor sees the new booking on their dashboard with farm location on map." },
    { num: "03", icon: "👷", title: "Labour Assigned to Farm", desc: "Supervisor assigns verified labour team to the farmer's location for the chosen slot." },
    { num: "04", icon: "🌾", title: "Work Completed", desc: "Labour arrives on time and completes the agricultural work at the farm." },
    { num: "05", icon: "✅", title: "Attendance Verified", desc: "Both farmer and supervisor confirm attendance — full record stored for admin review." },
];

const STATS = [
    { value: 500, suffix: "+", label: "Farmers Connected", icon: "🧑‍🌾" },
    { value: 1200, suffix: "+", label: "Labour Assigned", icon: "👷" },
    { value: 50, suffix: "+", label: "Active Supervisors", icon: "📋" },
    { value: 98, suffix: "%", label: "Attendance Accuracy", icon: "✅" },
];

const FARMER_BENEFITS = [
    "Quick labour access",
    "No middlemen",
    "Transparent system",
    "Reliable supervisors",
];

const SUPERVISOR_BENEFITS = [
    "Organised labour management",
    "Farm location visibility",
    "Attendance tracking",
    "Better coordination",
];

function useCountUp(target, duration, trigger) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!trigger) return;
        let start = 0;
        const step = target / (duration / 16);
        const t = setInterval(() => {
            start += step;
            if (start >= target) { setVal(target); clearInterval(t); }
            else setVal(Math.floor(start));
        }, 16);
        return () => clearInterval(t);
    }, [trigger, target, duration]);
    return val;
}

function useInView(threshold = 0.2) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, visible];
}

function StatItem({ value, suffix, label, icon, trigger }) {
    const count = useCountUp(value, 1600, trigger);
    return (
        <div className="flex flex-col items-center gap-2 p-6">
            <span className="text-4xl">{icon}</span>
            <span style={{ fontFamily: "'Poppins', sans-serif" }} className="text-4xl font-black text-green-800">
                {count.toLocaleString()}{suffix}
            </span>
            <span className="text-green-700 font-medium text-sm text-center">{label}</span>
        </div>
    );
}

// ── CONTACT FORM ──────────────────────────────
function ContactForm() {
    const formRef = useRef(null);
    const [fields, setFields] = useState({ name: "", email: "", role: "Farmer", message: "" });
    const [status, setStatus] = useState("idle"); // idle | sending | success | error
    const [errorMsg, setErrorMsg] = useState("");

    const handleChange = (e) => setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async () => {
        const { name, email, message } = fields;
        if (!name.trim() || !email.trim() || !message.trim()) {
            setStatus("error");
            setErrorMsg("Please fill in all required fields.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setStatus("error");
            setErrorMsg("Please enter a valid email address.");
            return;
        }

        setStatus("sending");
        setErrorMsg("");

        try {
            // Template variables sent to EmailJS:
            // {{from_name}}, {{from_email}}, {{role}}, {{message}}
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                {
                    from_name:  fields.name,
                    from_email: fields.email,
                    role:       fields.role,
                    message:    fields.message,
                },
                EMAILJS_PUBLIC_KEY
            );
            setStatus("success");
            setFields({ name: "", email: "", role: "Farmer", message: "" });
        } catch (err) {
            console.error("EmailJS error:", err);
            setStatus("error");
            setErrorMsg("Failed to send message. Please try again or email us directly.");
        }
    };

    const inputStyle = {
        fontFamily: "'Poppins', sans-serif",
        border: "1.5px solid #d8f3dc",
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 14,
        width: "100%",
        outline: "none",
        background: "#fff",
        color: "#1a1a1a",
        WebkitAppearance: "none",
        transition: "border-color 0.2s",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1b4332", display: "block", marginBottom: 6 }}>
                    Your Name <span style={{ color: "#e53935" }}>*</span>
                </label>
                <input
                    name="name"
                    type="text"
                    placeholder="Ramesh Patil"
                    value={fields.name}
                    onChange={handleChange}
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#d8f3dc"}
                />
            </div>

            <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1b4332", display: "block", marginBottom: 6 }}>
                    Email Address <span style={{ color: "#e53935" }}>*</span>
                </label>
                <input
                    name="email"
                    type="email"
                    placeholder="ramesh@example.com"
                    value={fields.email}
                    onChange={handleChange}
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#d8f3dc"}
                />
            </div>

            <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1b4332", display: "block", marginBottom: 6 }}>I am a...</label>
                <select
                    name="role"
                    value={fields.role}
                    onChange={handleChange}
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#d8f3dc"}
                >
                    <option>Farmer</option>
                    <option>Supervisor</option>
                    <option>Admin</option>
                    <option>Other</option>
                </select>
            </div>

            <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1b4332", display: "block", marginBottom: 6 }}>
                    Message <span style={{ color: "#e53935" }}>*</span>
                </label>
                <textarea
                    name="message"
                    rows={4}
                    placeholder="How can we help you?"
                    value={fields.message}
                    onChange={handleChange}
                    style={{ ...inputStyle, resize: "vertical" }}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#d8f3dc"}
                />
            </div>

            {/* Error banner */}
            {status === "error" && (
                <div style={{
                    background: "#fff3f3", border: "1.5px solid #ffb3b3", borderRadius: 10,
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
                }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <span style={{ fontSize: 13, color: "#c62828", fontWeight: 500 }}>{errorMsg}</span>
                </div>
            )}

            {/* Success banner */}
            {status === "success" && (
                <div style={{
                    background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10,
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
                    animation: "fadeUp 0.4s ease",
                }}>
                    <span style={{ fontSize: 22 }}>✅</span>
                    <div>
                        <div style={{ fontSize: 14, color: "#166534", fontWeight: 700 }}>Message sent successfully!</div>
                        <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>We'll get back to you within 24 hours.</div>
                    </div>
                </div>
            )}

            <button
                onClick={handleSubmit}
                disabled={status === "sending"}
                style={{
                    background: status === "sending" ? "#74c69d" : "#2d6a4f",
                    color: "#fff",
                    border: "none",
                    padding: "14px",
                    borderRadius: 50,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: status === "sending" ? "not-allowed" : "pointer",
                    fontFamily: "'Poppins', sans-serif",
                    width: "100%",
                    transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
                    boxShadow: "0 4px 18px rgba(45,106,79,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                }}
                onMouseOver={e => { if (status !== "sending") e.currentTarget.style.background = "#1b4332"; }}
                onMouseOut={e => { if (status !== "sending") e.currentTarget.style.background = "#2d6a4f"; }}
            >
                {status === "sending" ? (
                    <>
                        <span style={{
                            width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.4)",
                            borderTopColor: "#fff", borderRadius: "50%",
                            display: "inline-block",
                            animation: "spin 0.7s linear infinite",
                        }} />
                        Sending...
                    </>
                ) : (
                    "Send Message →"
                )}
            </button>
        </div>
    );
}

export default function Homepage() {
    const [loaded, setLoaded] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [statsRef, statsVisible] = useInView(0.3);
    const navigate = useNavigate();

    useEffect(() => {
        const t = setTimeout(() => setLoaded(true), 1800);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [menuOpen]);

    const scrollTo = (id) => {
        setMenuOpen(false);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Poppins', sans-serif; background: #f9fafb; color: #1a1a1a; }

        @keyframes spinBounce {
          0%,100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.3) rotate(20deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { transform: scale(1); } 50% { transform: scale(1.06); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .fade-up-1 { animation: fadeUp 0.7s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.25s ease both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.4s ease both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.55s ease both; }

        .role-card { transition: transform 0.28s ease, box-shadow 0.28s ease; }
        .role-card:hover { transform: translateY(-8px); box-shadow: 0 24px 48px rgba(0,0,0,0.13); }

        .feature-card { transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease; }
        .feature-card:hover { transform: translateY(-5px); box-shadow: 0 16px 36px rgba(0,0,0,0.10); background: #fff; }

        .step-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .step-card:hover { transform: translateY(-4px); box-shadow: 0 14px 32px rgba(0,0,0,0.10); }

        .btn-primary {
          background: #2d6a4f; color: #fff; border: none;
          padding: 14px 32px; border-radius: 50px; font-size: 15px;
          font-weight: 700; cursor: pointer; font-family: 'Poppins', sans-serif;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 18px rgba(45,106,79,0.35);
        }
        .btn-primary:hover { background: #1b4332; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(45,106,79,0.45); }

        .btn-secondary {
          background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.85);
          padding: 13px 30px; border-radius: 50px; font-size: 15px;
          font-weight: 600; cursor: pointer; font-family: 'Poppins', sans-serif;
          transition: background 0.2s, transform 0.2s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.15); transform: translateY(-2px); }

        .btn-outline {
          background: transparent; color: #2d6a4f; border: 2px solid #2d6a4f;
          padding: 12px 28px; border-radius: 50px; font-size: 14px;
          font-weight: 600; cursor: pointer; font-family: 'Poppins', sans-serif;
          transition: background 0.2s, color 0.2s, transform 0.2s;
        }
        .btn-outline:hover { background: #2d6a4f; color: #fff; transform: translateY(-2px); }

        .tag-badge {
          display: inline-block; background: #d8f3dc; color: #2d6a4f;
          font-size: 12px; font-weight: 600; padding: 4px 14px;
          border-radius: 20px; letter-spacing: 0.06em; text-transform: uppercase;
        }

        .section-title {
          font-size: clamp(26px, 4vw, 38px); font-weight: 800;
          color: #1b4332; line-height: 1.2;
        }
        .section-sub {
          font-size: 15px; color: #5c7a6b; line-height: 1.7; max-width: 540px; margin: 0 auto;
        }

        .nav-desktop-links {
          display: flex; align-items: center; gap: 32;
        }
        .nav-link {
          color: #2d6a4f; font-size: 14px; font-weight: 600;
          text-decoration: none; padding: 6px 4px;
          position: relative; transition: color 0.2s;
        }
        .nav-link::after {
          content: ''; position: absolute; bottom: 0; left: 0;
          width: 0; height: 2px; background: #2d6a4f;
          transition: width 0.25s ease;
        }
        .nav-link:hover::after { width: 100%; }
        .nav-link:hover { color: #1b4332; }

        .hero-bg {
          background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 40%, #40916c 70%, #52b788 100%);
          position: relative; overflow: hidden;
        }
        .hero-bg::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(circle at 15% 50%, rgba(255,255,255,0.06) 0%, transparent 50%),
            radial-gradient(circle at 85% 30%, rgba(255,255,255,0.04) 0%, transparent 40%);
        }
        .hero-pattern {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 80px;
          background: #f9fafb;
          clip-path: ellipse(55% 100% at 50% 100%);
        }

        .stat-divider { border-left: 1px solid #b7e4c7; }
        .stat-divider:first-child { border-left: none; }

        .benefit-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 0; border-bottom: 1px dashed #d8f3dc;
          font-size: 14px; color: #2d4a3e; font-weight: 500;
        }
        .benefit-item:last-child { border-bottom: none; }

        .cta-section {
          background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 50%, #40916c 100%);
          position: relative; overflow: hidden;
        }
        .cta-section::before {
          content: ''; position: absolute; top: -50%; right: -10%;
          width: 500px; height: 500px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
        }
        .cta-section::after {
          content: ''; position: absolute; bottom: -30%; left: -5%;
          width: 350px; height: 350px; border-radius: 50%;
          background: rgba(255,255,255,0.03);
        }

        .footer-bg { background: #1b4332; }

        .map-preview {
          background:
            linear-gradient(rgba(27,67,50,0.55), rgba(27,67,50,0.55)),
            repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(255,255,255,0.05) 29px, rgba(255,255,255,0.05) 30px),
            repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(255,255,255,0.05) 29px, rgba(255,255,255,0.05) 30px),
            linear-gradient(135deg, #2d6a4f, #40916c, #52b788);
          border-radius: 16px;
          position: relative;
        }

        .ticker { overflow: hidden; white-space: nowrap; background: #d8f3dc; }
        .ticker-inner { display: inline-flex; animation: marquee 22s linear infinite; }

        /* ── MOBILE MENU OVERLAY ── */
        .mobile-menu-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 99;
          background: rgba(0,0,0,0.4);
          animation: fadeIn 0.2s ease;
        }
        .mobile-menu-drawer {
          position: fixed;
          top: 0; right: 0;
          width: min(320px, 85vw);
          height: 100vh;
          background: #fff;
          z-index: 100;
          padding: 0;
          box-shadow: -8px 0 40px rgba(0,0,0,0.18);
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.28s cubic-bezier(0.4,0,0.2,1);
          overflow-y: auto;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.5; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .mobile-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid #e8f5e9;
          background: #f4fdf6;
        }
        .mobile-menu-body {
          padding: 20px;
          flex: 1;
        }
        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 12px;
          border-radius: 12px;
          color: #1b4332;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid #f0faf3;
        }
        .mobile-nav-link:last-of-type { border-bottom: none; }
        .mobile-nav-link:hover { background: #f4fdf6; }

        .hamburger-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .hamburger-btn:hover { background: #f0faf3; }

        @media (max-width: 900px) {
          .nav-desktop-links { display: none !important; }
          .nav-desktop-actions { display: none !important; }
          .hamburger-btn { display: flex !important; align-items: center; justify-content: center; }
        }

        @media (max-width: 900px) {
          .mobile-menu-overlay.open { display: block; }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .stat-divider { border-left: none; border-top: 1px solid #b7e4c7; }
          .stat-divider:first-child { border-top: none; }
          .stat-divider:nth-child(2) { border-top: none; border-left: 1px solid #b7e4c7; }
        }

        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        @media (max-width: 520px) {
          .hero-badges { flex-direction: column !important; align-items: center !important; }
          .hero-badges > div { width: 100%; max-width: 280px; }
        }

        @media (max-width: 480px) {
          .hero-btns { flex-direction: column !important; align-items: stretch !important; width: 100%; max-width: 320px; margin-left: auto; margin-right: auto; }
          .hero-btns button { width: 100%; }
        }

        @media (max-width: 600px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .step-connector { display: none !important; }
        }

        @media (max-width: 480px) {
          .cta-btns { flex-direction: column !important; align-items: stretch !important; max-width: 300px; margin-left: auto; margin-right: auto; }
          .cta-btns button { width: 100%; }
        }

        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 400px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 520px) {
          .footer-bottom { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 8px !important; }
        }

        @media (max-width: 480px) {
          .contact-form-box { padding: 28px 20px !important; }
        }

        @media (max-width: 640px) {
          .section-pad { padding: 60px 16px !important; }
        }

        @media (max-width: 480px) {
          .benefits-grid { grid-template-columns: 1fr !important; }
          .roles-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

            <div style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease" }}>

                {/* ── NAVBAR ── */}
                <nav style={{
                    position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
                    background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(12px)",
                    boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.09)" : "none",
                    borderBottom: scrolled ? "1px solid #e8f5e9" : "1px solid transparent",
                    transition: "box-shadow 0.3s, border-color 0.3s",
                }}>
                    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => scrollTo("home")}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #2d6a4f, #40916c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(45,106,79,0.3)", flexShrink: 0 }}>🌱</div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 18, color: "#1b4332", lineHeight: 1.1 }}>KrishiSetu</div>
                                <div style={{ fontSize: 10, color: "#52b788", fontWeight: 500, letterSpacing: "0.04em" }}>Connecting Farmers with Labour</div>
                            </div>
                        </div>

                        <div className="nav-desktop-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
                            {NAV_LINKS.map(l => (
                                <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`} className="nav-link"
                                    onClick={e => { e.preventDefault(); scrollTo(l.toLowerCase().replace(" ", "-")); }}>
                                    {l}
                                </a>
                            ))}
                        </div>

                        <div className="nav-desktop-actions" style={{ display: "flex", gap: 10 }}>
                            <button className="btn-outline" style={{ padding: "9px 22px", fontSize: 13 }} onClick={() => navigate("/login")}>Login</button>
                            <button className="btn-primary" style={{ padding: "9px 22px", fontSize: 13 }} onClick={() => navigate("/register")}>Register</button>
                        </div>

                        <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" style={{ display: "none" }}>
                            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                {menuOpen ? (
                                    <>
                                        <line x1="4" y1="4" x2="22" y2="22" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                        <line x1="22" y1="4" x2="4" y2="22" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                    </>
                                ) : (
                                    <>
                                        <line x1="4" y1="7" x2="22" y2="7" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                        <line x1="4" y1="13" x2="22" y2="13" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                        <line x1="4" y1="19" x2="22" y2="19" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                    </>
                                )}
                            </svg>
                        </button>
                    </div>
                </nav>

                {/* ── MOBILE MENU ── */}
                {menuOpen && (
                    <div className="mobile-menu-overlay open" onClick={() => setMenuOpen(false)} style={{ display: "block" }} />
                )}
                {menuOpen && (
                    <div className="mobile-menu-drawer">
                        <div className="mobile-menu-header">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #2d6a4f, #40916c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌱</div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1b4332" }}>KrishiSetu</div>
                                    <div style={{ fontSize: 9, color: "#52b788", fontWeight: 500 }}>Agricultural Labour Platform</div>
                                </div>
                            </div>
                            <button onClick={() => setMenuOpen(false)} style={{ background: "#e8f5e9", border: "none", borderRadius: 8, cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <line x1="2" y1="2" x2="16" y2="16" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                    <line x1="16" y1="2" x2="2" y2="16" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                        <div className="mobile-menu-body">
                            <div style={{ marginBottom: 8 }}>
                                {[
                                    { label: "Home", icon: "🏠", id: "home" },
                                    { label: "How It Works", icon: "⚙️", id: "how-it-works" },
                                    { label: "About", icon: "ℹ️", id: "about" },
                                    { label: "Contact", icon: "📞", id: "contact" },
                                ].map(link => (
                                    <div key={link.label} className="mobile-nav-link" onClick={() => scrollTo(link.id)}>
                                        <span style={{ fontSize: 18 }}>{link.icon}</span>
                                        <span>{link.label}</span>
                                        <span style={{ marginLeft: "auto", color: "#b7e4c7", fontSize: 14 }}>›</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ borderTop: "1px solid #e8f5e9", paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                                <button className="btn-outline" style={{ width: "100%", fontSize: 14, padding: "13px" }} onClick={() => { setMenuOpen(false); navigate("/login"); }}>🔑 Login</button>
                                <button className="btn-primary" style={{ width: "100%", fontSize: 14, padding: "13px" }} onClick={() => { setMenuOpen(false); navigate("/register"); }}>🌾 Register as Farmer</button>
                            </div>
                            <div style={{ marginTop: 28, padding: "16px", background: "#f4fdf6", borderRadius: 14, border: "1px solid #d8f3dc" }}>
                                <div style={{ fontSize: 11, color: "#2d6a4f", fontWeight: 700, marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>📞 Contact</div>
                                <div style={{ fontSize: 13, color: "#3a3a3a", marginBottom: 4 }}>contact@krishisetu.in</div>
                                <div style={{ fontSize: 13, color: "#3a3a3a" }}>+91 98765 43210</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── HERO ── */}
                <section id="home" className="hero-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 68 }}>
                    <span style={{ position: "absolute", top: "18%", left: "6%", fontSize: 48, opacity: 0.13, animation: "spinBounce 7s ease-in-out infinite", userSelect: "none" }}>🌾</span>
                    <span style={{ position: "absolute", top: "30%", right: "8%", fontSize: 40, opacity: 0.10, animation: "spinBounce 9s ease-in-out 1s infinite", userSelect: "none" }}>🚜</span>
                    <span style={{ position: "absolute", bottom: "22%", left: "12%", fontSize: 36, opacity: 0.10, animation: "spinBounce 8s ease-in-out 2s infinite", userSelect: "none" }}>🌿</span>
                    <span style={{ position: "absolute", bottom: "30%", right: "14%", fontSize: 32, opacity: 0.10, animation: "spinBounce 6s ease-in-out 0.5s infinite", userSelect: "none" }}>🍃</span>

                    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 20px 120px", textAlign: "center", position: "relative", zIndex: 2, width: "100%" }}>
                        <div className="fade-up-1">
                            <span className="tag-badge" style={{ background: "rgba(255,255,255,0.15)", color: "#d8f3dc", marginBottom: 24, display: "inline-block" }}>
                                🇮🇳 India's Agricultural Labour Platform
                            </span>
                        </div>
                        <h1 className="fade-up-2" style={{ fontSize: "clamp(28px, 6vw, 64px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.02em" }}>
                            Bridging Farmers and<br /><span style={{ color: "#95d5b2" }}>Agricultural Labour</span>
                        </h1>
                        <p className="fade-up-3" style={{ fontSize: "clamp(13px, 2vw, 18px)", color: "rgba(255,255,255,0.8)", maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.7 }}>
                            KrishiSetu helps farmers easily find labour while supervisors manage workforce efficiently — all in one transparent platform.
                        </p>
                        <div className="fade-up-4 hero-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
                            <button className="btn-primary" style={{ fontSize: 15, padding: "15px 36px", background: "#fff", color: "#1b4332" }} onClick={() => navigate("/register")}>🌾 Register as Farmer</button>
                            <button className="btn-secondary" onClick={() => navigate("/login")}>🔑 Login</button>
                        </div>
                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontStyle: "italic" }}>✦ Trusted by farmers and supervisors across Maharashtra</p>
                        <div className="hero-badges" style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 52, flexWrap: "wrap" }}>
                            {[
                                { icon: "📍", label: "Farm Pinned", val: "Your Location", color: "#d8f3dc", text: "#1b4332" },
                                { icon: "👷", label: "Labour Available", val: "12 Workers", color: "#fff3cd", text: "#7c4f00" },
                                { icon: "✅", label: "Attendance", val: "Verified", color: "#d1fae5", text: "#065f46" },
                            ].map(c => (
                                <div key={c.label} style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, animation: "fadeIn 0.8s ease both" }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{c.icon}</div>
                                    <div style={{ textAlign: "left" }}>
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{c.label}</div>
                                        <div style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{c.val}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="hero-pattern" />
                </section>

                {/* ── TICKER ── */}
                <div className="ticker" style={{ padding: "10px 0" }}>
                    <div className="ticker-inner">
                        {[...Array(2)].map((_, i) => (
                            <span key={i} style={{ display: "inline-flex", gap: 40, paddingRight: 40 }}>
                                {["🌾 First Come First Serve", "📍 Live GPS Tracking", "✅ Dual Attendance Verification", "👷 Verified Labour Teams", "📅 Flexible Time Slots", "⚠️ Mismatch Detection"].map(t => (
                                    <span key={t} style={{ fontSize: 13, fontWeight: 600, color: "#2d6a4f", whiteSpace: "nowrap", paddingRight: 48 }}>{t}</span>
                                ))}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── STATS ── */}
                <section ref={statsRef} style={{ background: "#fff", borderBottom: "1px solid #e8f5e9" }}>
                    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
                        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
                            {STATS.map((s) => (
                                <div key={s.label} className="stat-divider" style={{ textAlign: "center" }}>
                                    <StatItem {...s} trigger={statsVisible} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── ROLES ── */}
                <section id="how-it-works" className="section-pad" style={{ background: "#f4fdf6", padding: "88px 24px" }}>
                    <div style={{ maxWidth: 1180, margin: "0 auto", textAlign: "center" }}>
                        <span className="tag-badge" style={{ marginBottom: 14, display: "inline-block" }}>Platform Roles</span>
                        <h2 className="section-title" style={{ marginBottom: 12 }}>How KrishiSetu Works</h2>
                        <p className="section-sub" style={{ marginBottom: 52 }}>Three powerful roles working together to make agricultural labour management seamless and transparent.</p>
                        <div className="roles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                            {ROLES.map(r => (
                                <div key={r.title} className="role-card" style={{ background: "#fff", borderRadius: 20, padding: "36px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `2px solid ${r.border}`, textAlign: "left" }}>
                                    <div style={{ width: 64, height: 64, borderRadius: 18, background: r.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 18 }}>{r.icon}</div>
                                    <h3 style={{ fontSize: 22, fontWeight: 800, color: r.color, marginBottom: 18 }}>{r.title}</h3>
                                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                                        {r.points.map(p => (
                                            <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#3a3a3a", lineHeight: 1.5 }}>
                                                <span style={{ color: r.color, fontWeight: 700, marginTop: 1 }}>✓</span>{p}
                                            </li>
                                        ))}
                                    </ul>
                                    <button className="btn-primary" style={{ marginTop: 24, width: "100%", background: r.color, fontSize: 13 }} onClick={() => r.title === "Farmer" ? navigate("/register") : navigate("/login")}>
                                        Get {r.title} Access →
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FEATURES ── */}
                <section id="features" className="section-pad" style={{ background: "#fff", padding: "88px 24px" }}>
                    <div style={{ maxWidth: 1180, margin: "0 auto", textAlign: "center" }}>
                        <span className="tag-badge" style={{ marginBottom: 14, display: "inline-block" }}>Platform Features</span>
                        <h2 className="section-title" style={{ marginBottom: 12 }}>Key Features of KrishiSetu</h2>
                        <p className="section-sub" style={{ marginBottom: 52 }}>Everything built for the real needs of India's agricultural ecosystem — from field to dashboard.</p>
                        <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 20 }}>
                            {FEATURES.map(f => (
                                <div key={f.title} className="feature-card" style={{ background: "#f9fdf9", borderRadius: 16, padding: "28px 24px", textAlign: "left", border: "1.5px solid #e8f5e9", cursor: "pointer" }}>
                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#d8f3dc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16 }}>{f.icon}</div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1b4332", marginBottom: 8 }}>{f.title}</h3>
                                    <p style={{ fontSize: 13.5, color: "#5c7a6b", lineHeight: 1.65 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 48, borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
                            <div className="map-preview" style={{ padding: "48px 20px", textAlign: "center" }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
                                <h3 style={{ color: "#fff", fontSize: "clamp(18px,3vw,22px)", fontWeight: 800, marginBottom: 8 }}>Interactive Farm Mapping</h3>
                                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, maxWidth: 380, margin: "0 auto 20px" }}>Farmers drop a pin on the map. Supervisors track location and route their teams perfectly.</p>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 50, padding: "10px 22px", border: "1px solid rgba(255,255,255,0.25)" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#74c69d", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                                    <span style={{ color: "#d8f3dc", fontSize: 13, fontWeight: 600 }}>Live Location Active</span>
                                </div>
                                <div style={{ position: "relative", marginTop: 24, height: 100 }}>
                                    {[{ left: "20%", top: "30%", label: "Farm A" }, { left: "55%", top: "15%", label: "Farm B" }, { left: "72%", top: "55%", label: "Farm C" }].map(pin => (
                                        <div key={pin.label} style={{ position: "absolute", left: pin.left, top: pin.top, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <span style={{ fontSize: 24 }}>📍</span>
                                            <span style={{ background: "rgba(255,255,255,0.9)", color: "#1b4332", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, marginTop: 2 }}>{pin.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── WORKFLOW ── */}
                <section className="section-pad" style={{ background: "#f4fdf6", padding: "88px 24px" }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
                        <span className="tag-badge" style={{ marginBottom: 14, display: "inline-block" }}>Booking Flow</span>
                        <h2 className="section-title" style={{ marginBottom: 12 }}>How Booking Works</h2>
                        <p className="section-sub" style={{ marginBottom: 56 }}>Five transparent steps from request to verified attendance — simple, fair, and trustworthy.</p>
                        <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                            {STEPS.map((step, i) => (
                                <div key={step.num} className="step-card" style={{ position: "relative" }}>
                                    {i < STEPS.length - 1 && (
                                        <div className="step-connector" style={{ position: "absolute", top: 28, left: "calc(50% + 30px)", width: "calc(100% - 30px)", height: 2, background: "linear-gradient(90deg, #2d6a4f40, #74c69d40)", zIndex: 0 }} />
                                    )}
                                    <div style={{ background: "#fff", borderRadius: 18, padding: "28px 18px 22px", boxShadow: "0 4px 18px rgba(0,0,0,0.06)", border: "1.5px solid #d8f3dc", position: "relative", zIndex: 1 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 50, margin: "0 auto 14px", background: "linear-gradient(135deg, #2d6a4f, #40916c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 12px rgba(45,106,79,0.3)" }}>{step.icon}</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#74c69d", letterSpacing: "0.08em", marginBottom: 6 }}>STEP {step.num}</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", marginBottom: 8, lineHeight: 1.3 }}>{step.title}</div>
                                        <div style={{ fontSize: 12, color: "#5c7a6b", lineHeight: 1.6 }}>{step.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── BENEFITS ── */}
                <section id="about" className="section-pad" style={{ background: "#fff", padding: "88px 24px" }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                        <div style={{ textAlign: "center", marginBottom: 52 }}>
                            <span className="tag-badge" style={{ marginBottom: 14, display: "inline-block" }}>Why KrishiSetu</span>
                            <h2 className="section-title">Why Use KrishiSetu?</h2>
                            <p className="section-sub" style={{ marginTop: 10 }}>Built for every stakeholder in India's agricultural supply chain.</p>
                        </div>
                        <div className="benefits-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28 }}>
                            <div style={{ background: "#f4fdf6", borderRadius: 20, padding: "32px 28px", border: "1.5px solid #b7e4c7" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: "#d8f3dc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🧑‍🌾</div>
                                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#1b4332" }}>For Farmers</h3>
                                </div>
                                {FARMER_BENEFITS.map(b => (
                                    <div key={b} className="benefit-item">
                                        <span style={{ color: "#2d6a4f", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>✓</span>{b}
                                    </div>
                                ))}
                                <button className="btn-primary" style={{ marginTop: 24, width: "100%", fontSize: 13 }} onClick={() => navigate("/register")}>Register as Farmer →</button>
                            </div>
                            <div style={{ background: "#fdf8f4", borderRadius: 20, padding: "32px 28px", border: "1.5px solid #f4c0a0" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fde8d8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👨‍💼</div>
                                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#774936" }}>For Supervisors</h3>
                                </div>
                                {SUPERVISOR_BENEFITS.map(b => (
                                    <div key={b} className="benefit-item" style={{ borderBottomColor: "#f4c0a050" }}>
                                        <span style={{ color: "#774936", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>✓</span>{b}
                                    </div>
                                ))}
                                <button className="btn-primary" style={{ marginTop: 24, width: "100%", fontSize: 13, background: "#774936" }} onClick={() => navigate("/login")}>Login as Supervisor →</button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── CTA ── */}
                <section className="cta-section section-pad" style={{ padding: "88px 24px" }}>
                    <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
                        <span style={{ fontSize: 52, display: "block", marginBottom: 20, animation: "spinBounce 4s ease-in-out infinite" }}>🌱</span>
                        <h2 style={{ fontSize: "clamp(22px, 5vw, 46px)", fontWeight: 900, color: "#fff", marginBottom: 16, lineHeight: 1.15 }}>
                            Start Managing Farm Labour<br />the Smart Way
                        </h2>
                        <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "clamp(13px,2vw,16px)", lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
                            Join thousands of farmers, supervisors, and labourers already transforming Indian agriculture with KrishiSetu.
                        </p>
                        <div className="cta-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                            <button className="btn-primary" style={{ background: "#fff", color: "#1b4332", fontSize: 15, padding: "15px 32px" }} onClick={() => navigate("/register")}>🌾 Register as Farmer</button>
                            <button className="btn-secondary" style={{ fontSize: 15, padding: "15px 32px" }} onClick={() => navigate("/login")}>🔑 Login</button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 28, flexWrap: "wrap" }}>
                            {["No cancellation", "First come first serve", "100% transparent"].map(t => (
                                <span key={t} style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ color: "#74c69d" }}>✓</span> {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CONTACT ── */}
                <section id="contact" className="section-pad" style={{ background: "#f4fdf6", padding: "88px 24px" }}>
                    <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
                        <span className="tag-badge" style={{ marginBottom: 14, display: "inline-block" }}>Get In Touch</span>
                        <h2 className="section-title" style={{ marginBottom: 12 }}>Contact Us</h2>
                        <p className="section-sub" style={{ marginBottom: 40 }}>Have questions? We're here to help farmers and supervisors get the most out of KrishiSetu.</p>

                        <div className="contact-form-box" style={{ background: "#fff", borderRadius: 24, padding: "40px 36px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)", border: "1.5px solid #d8f3dc", textAlign: "left" }}>
                            <ContactForm />
                        </div>
                    </div>
                </section>

                {/* ── FOOTER ── */}
                <footer className="footer-bg" style={{ padding: "56px 20px 28px" }}>
                    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
                        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 48 }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #40916c, #74c69d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🌱</div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>KrishiSetu</div>
                                        <div style={{ fontSize: 10, color: "#74c69d" }}>Connecting Farmers with Labour</div>
                                    </div>
                                </div>
                                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>Transparent, fair, and efficient agricultural labour management for rural India.</p>
                                <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,255,255,0.07)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", display: "inline-block" }}>
                                    <div style={{ fontSize: 10, color: "#74c69d", fontWeight: 600, marginBottom: 2 }}>🏆 BUILT FOR</div>
                                    <div style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>Innovation Hackathon 2025</div>
                                </div>
                            </div>
                            <div>
                                <h4 style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 18 }}>Quick Links</h4>
                                {["Home", "About", "How it Works", "Contact"].map(l => (
                                    <div key={l} style={{ marginBottom: 10 }}>
                                        <a href="#" style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, textDecoration: "none" }}
                                            onMouseOver={e => e.target.style.color = "#74c69d"}
                                            onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.55)"}
                                            onClick={e => { e.preventDefault(); scrollTo(l.toLowerCase().replace(" ", "-")); }}>
                                            → {l}
                                        </a>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4 style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 18 }}>Roles</h4>
                                {["For Farmers", "For Supervisors", "For Admins", "For Labour"].map(r => (
                                    <div key={r} style={{ marginBottom: 10 }}>
                                        <a href="#" style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, textDecoration: "none" }}
                                            onMouseOver={e => e.target.style.color = "#74c69d"}
                                            onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.55)"}>
                                            → {r}
                                        </a>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4 style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 18 }}>Contact Info</h4>
                                {[
                                    { icon: "📧", label: "contact@krishisetu.in" },
                                    { icon: "📞", label: "+91 98765 43210" },
                                    { icon: "📍", label: "Pune, Maharashtra" },
                                ].map(c => (
                                    <div key={c.label} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                                        <span>{c.icon}</span>
                                        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="footer-bottom" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>© 2025 KrishiSetu. Made with ❤️ for Indian Agriculture.</span>
                            <div style={{ display: "flex", gap: 20 }}>
                                {["Privacy Policy", "Terms", "Support"].map(l => (
                                    <a key={l} href="#" style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textDecoration: "none" }}
                                        onMouseOver={e => e.target.style.color = "#74c69d"}
                                        onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.35)"}>
                                        {l}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </footer>

            </div>
        </>
    );
}