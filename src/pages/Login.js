import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { Leaf, Mail, Lock, ChevronRight, Sprout, Users, ShieldCheck } from "lucide-react";

const roles = [
  {
    id: "farmer",
    label: "Farmer",
    icon: Sprout,
    description: "Request & manage farm labour",
    color: "#2d6a4f",
    bg: "#f4fdf6",
    border: "#b7e4c7",
    accent: "#52b788",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    icon: Users,
    description: "Manage labour groups",
    color: "#774936",
    bg: "#fdf6f3",
    border: "#f4c0a0",
    accent: "#c07850",
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    description: "Full system control",
    color: "#1b4332",
    bg: "#f0f7f3",
    border: "#a8d5b8",
    accent: "#2d6a4f",
  },
];

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("farmer");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectedRole = roles.find((r) => r.id === role);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== role) {
          toast.error(`You are not registered as a ${role}!`);
          setLoading(false);
          return;
        }
        toast.success(`Welcome back! 🌾`);
        setTimeout(() => {
          if (role === "farmer") navigate("/farmer/dashboard");
          else if (role === "supervisor") navigate("/supervisor/dashboard");
          else if (role === "admin") navigate("/admin/dashboard");
        }, 800);
      } else {
        toast.error("User not found! Please register.");
      }
    } catch (err) {
      toast.error("Invalid email or password!");
    }
    setLoading(false);
  };

  return (
    <div style={styles.root}>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontFamily: "'Poppins', sans-serif",
            fontSize: "13px",
            borderRadius: "10px",
            border: "1px solid #e8f5e9",
            boxShadow: "0 4px 20px rgba(27,67,50,0.08)",
          },
        }}
      />

      {/* Subtle texture */}
      <div style={styles.texture} />

      <div style={styles.wrapper}>

        {/* ── LEFT COLUMN ── */}
        <motion.div
          style={styles.left}
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Wordmark */}
          <div style={styles.wordmark}>
            <div style={styles.logoMark}>
              <Leaf size={16} color="#ffffff" strokeWidth={2.5} />
            </div>
            <span style={styles.wordmarkText}>KrishiSetu</span>
          </div>

          {/* Headline */}
          <div style={styles.headlineBlock}>
            <p style={styles.eyebrow}>Agricultural Labour Platform</p>
            <h1 style={styles.headline}>
              The bridge between<br />
              <em style={styles.headlineEm}>farms</em> and <em style={styles.headlineEm}>labour.</em>
            </h1>
            <p style={styles.body}>
              A transparent, GPS-verified platform bringing
              dignity and efficiency to rural Maharashtra's
              agricultural workforce.
            </p>
          </div>

          {/* Stats */}
          <div style={styles.statsRow}>
            {[
              { value: "500+", label: "Farmers onboarded" },
              { value: "50+", label: "Active supervisors" },
              { value: "2,000+", label: "Labourers managed" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                style={styles.stat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              >
                <span style={styles.statValue}>{s.value}</span>
                <span style={styles.statLabel}>{s.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Decorative strip */}
          <div style={styles.decorStrip}>
            {["Attendance Tracking", "GPS Accountability", "Dual Confirmation", "Real-time Labour"].map((t) => (
              <span key={t} style={styles.pill}>{t}</span>
            ))}
          </div>
        </motion.div>

        {/* ── RIGHT COLUMN ── */}
        <motion.div
          style={styles.right}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={styles.card}>

            {/* Card header */}
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Sign in</h2>
              <p style={styles.cardSub}>Access your KrishiSetu account</p>
            </div>

            {/* Role tabs */}
            <div style={styles.roleTabs}>
              {roles.map((r) => {
                const Icon = r.icon;
                const active = role === r.id;
                return (
                  <motion.button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      ...styles.roleTab,
                      backgroundColor: active ? r.bg : "transparent",
                      borderColor: active ? r.border : "#e8f0eb",
                      color: active ? r.color : "#8aab97",
                    }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                    <span style={styles.roleTabLabel}>{r.label}</span>
                    {active && (
                      <motion.div
                        layoutId="roleIndicator"
                        style={{ ...styles.roleIndicator, backgroundColor: r.accent }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Role hint */}
            <AnimatePresence mode="wait">
              <motion.div
                key={role}
                style={{ ...styles.roleHint, borderLeftColor: selectedRole.accent }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
              >
                <span style={{ ...styles.roleHintText, color: selectedRole.color }}>
                  {selectedRole.description}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleLogin} style={{ marginTop: "20px" }}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email address</label>
                <div style={styles.inputWrap}>
                  <Mail size={14} color="#8aab97" style={styles.fieldIcon} />
                  <input
                    style={styles.input}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    onFocus={(e) => {
                      e.target.style.borderColor = selectedRole.accent;
                      e.target.style.boxShadow = `0 0 0 3px ${selectedRole.bg}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#dde8e2";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Password</label>
                <div style={styles.inputWrap}>
                  <Lock size={14} color="#8aab97" style={styles.fieldIcon} />
                  <input
                    style={styles.input}
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    onFocus={(e) => {
                      e.target.style.borderColor = selectedRole.accent;
                      e.target.style.boxShadow = `0 0 0 3px ${selectedRole.bg}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#dde8e2";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  background: `linear-gradient(135deg, ${selectedRole.accent}, ${selectedRole.color})`,
                }}
                whileHover={{ opacity: 0.92, y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.15 }}
              >
                {loading ? (
                  <motion.div
                    style={styles.spinner}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
                  />
                ) : (
                  <>
                    <span>Continue as {selectedRole.label}</span>
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Footer */}
            <div style={styles.cardFooter}>
              {role === "farmer" && (
                <>
                  <div style={styles.divider}>
                    <span style={styles.dividerLine} />
                    <span style={styles.dividerWord}>or</span>
                    <span style={styles.dividerLine} />
                  </div>
                  <motion.button
                    style={styles.registerBtn}
                    onClick={() => navigate("/register")}
                    whileHover={{ backgroundColor: "#f4fdf6" }}
                    whileTap={{ scale: 0.985 }}
                  >
                    New farmer? Create an account
                  </motion.button>
                </>
              )}
              {role === "supervisor" && (
                <p style={styles.infoNote}>
                  Supervisor accounts are provisioned by your Admin.
                </p>
              )}
              {role === "admin" && (
                <p style={styles.infoNote}>
                  Admin access is restricted to authorised personnel.
                </p>
              )}
            </div>

          </div>
        </motion.div>

      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#f7faf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Poppins', 'Segoe UI', sans-serif",
    position: "relative",
    padding: "40px 24px",
  },
  texture: {
    position: "fixed",
    inset: 0,
    backgroundImage: `radial-gradient(circle at 70% 10%, rgba(82,183,136,0.07) 0%, transparent 55%),
                      radial-gradient(circle at 10% 80%, rgba(119,73,54,0.04) 0%, transparent 50%)`,
    pointerEvents: "none",
    zIndex: 0,
  },
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: "72px",
    width: "100%",
    maxWidth: "1040px",
    position: "relative",
    zIndex: 1,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  /* ── LEFT ── */
  left: {
    flex: "0 0 400px",
    minWidth: "280px",
  },
  wordmark: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "52px",
  },
  logoMark: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "linear-gradient(135deg, #2d6a4f, #1b4332)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(45,106,79,0.28)",
  },
  wordmarkText: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#1b4332",
    letterSpacing: "-0.3px",
  },
  headlineBlock: {
    marginBottom: "48px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#52b788",
    letterSpacing: "2px",
    textTransform: "uppercase",
    margin: "0 0 14px 0",
  },
  headline: {
    fontSize: "42px",
    fontWeight: "800",
    color: "#1b4332",
    lineHeight: 1.18,
    margin: "0 0 18px 0",
    letterSpacing: "-1.5px",
  },
  headlineEm: {
    fontStyle: "italic",
    color: "#2d6a4f",
    fontWeight: "800",
  },
  body: {
    fontSize: "14.5px",
    color: "#5c7a6b",
    lineHeight: 1.75,
    margin: 0,
    maxWidth: "340px",
  },
  statsRow: {
    display: "flex",
    gap: "28px",
    paddingTop: "4px",
    marginBottom: "36px",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  statValue: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#1b4332",
    letterSpacing: "-0.8px",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "11px",
    color: "#8aab97",
    fontWeight: "500",
    letterSpacing: "0.2px",
  },
  decorStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  pill: {
    fontSize: "11px",
    fontWeight: "500",
    color: "#5c7a6b",
    backgroundColor: "#eef7f1",
    border: "1px solid #d8f0e2",
    borderRadius: "20px",
    padding: "4px 12px",
    letterSpacing: "0.1px",
  },

  /* ── RIGHT ── */
  right: {
    flex: "0 0 380px",
    minWidth: "300px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    border: "1px solid #e4ede8",
    padding: "36px 32px 32px",
    boxShadow: "0 4px 32px rgba(27,67,50,0.07), 0 1px 4px rgba(27,67,50,0.04)",
  },
  cardHeader: {
    marginBottom: "24px",
  },
  cardTitle: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#1b4332",
    margin: "0 0 5px",
    letterSpacing: "-0.5px",
  },
  cardSub: {
    fontSize: "13px",
    color: "#8aab97",
    margin: 0,
    fontWeight: "400",
  },

  /* Role tabs */
  roleTabs: {
    display: "flex",
    gap: "7px",
    marginBottom: "12px",
  },
  roleTab: {
    flex: 1,
    padding: "10px 6px 10px",
    borderRadius: "10px",
    border: "1.5px solid",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    position: "relative",
    transition: "background-color 0.2s, border-color 0.2s, color 0.2s",
    outline: "none",
  },
  roleTabLabel: {
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.3px",
  },
  roleIndicator: {
    position: "absolute",
    bottom: "7px",
    width: "16px",
    height: "2.5px",
    borderRadius: "2px",
  },
  roleHint: {
    borderLeft: "3px solid",
    paddingLeft: "10px",
    marginBottom: "4px",
  },
  roleHintText: {
    fontSize: "12px",
    fontWeight: "500",
  },

  /* Fields */
  fieldGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#3d6352",
    marginBottom: "7px",
    letterSpacing: "0.2px",
  },
  inputWrap: {
    position: "relative",
  },
  fieldIcon: {
    position: "absolute",
    left: "13px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "11px 14px 11px 38px",
    backgroundColor: "#fafcfb",
    border: "1.5px solid #dde8e2",
    borderRadius: "10px",
    fontSize: "13.5px",
    color: "#1a1a1a",
    fontFamily: "'Poppins', sans-serif",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.18s, box-shadow 0.18s",
  },
  submitBtn: {
    width: "100%",
    padding: "13px 18px",
    border: "none",
    borderRadius: "10px",
    fontSize: "13.5px",
    fontWeight: "700",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    marginTop: "6px",
    letterSpacing: "0.1px",
    boxShadow: "0 4px 18px rgba(45,106,79,0.25)",
    fontFamily: "'Poppins', sans-serif",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #ffffff",
    borderRadius: "50%",
  },
  cardFooter: {
    marginTop: "18px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "#eaeff0",
    display: "block",
  },
  dividerWord: {
    fontSize: "11px",
    color: "#b0c4bb",
    fontWeight: "500",
    letterSpacing: "0.5px",
  },
  registerBtn: {
    width: "100%",
    padding: "12px",
    backgroundColor: "transparent",
    border: "1.5px solid #dde8e2",
    borderRadius: "10px",
    fontSize: "13px",
    color: "#2d6a4f",
    cursor: "pointer",
    fontWeight: "600",
    fontFamily: "'Poppins', sans-serif",
    transition: "background-color 0.15s",
    letterSpacing: "0.1px",
  },
  infoNote: {
    textAlign: "center",
    color: "#9db8aa",
    fontSize: "12.5px",
    margin: 0,
    lineHeight: 1.6,
    fontStyle: "italic",
  },
};

export default Login;