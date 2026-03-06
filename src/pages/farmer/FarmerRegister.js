import React, { useState } from "react";
import { auth, db } from "../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Leaf,
  Mail,
  Lock,
  Phone,
  User,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Sprout,
  CheckCircle2,
} from "lucide-react";

const steps = [
  { id: 1, title: "Personal Info", subtitle: "Tell us about yourself" },
  { id: 2, title: "Account Setup", subtitle: "Create your credentials" },
  { id: 3, title: "Farm Details", subtitle: "Where is your farm?" },
];

function FarmerRegister() {
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [village, setVillage] = useState("");
  const [farmSize, setFarmSize] = useState("");
  const [cropType, setCropType] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const navigate = useNavigate();

  const validateStep = () => {
    if (currentStep === 1) {
      if (!name.trim()) { toast.error("Please enter your name!"); return false; }
      if (phone.length !== 10) { toast.error("Enter valid 10 digit phone!"); return false; }
      return true;
    }
    if (currentStep === 2) {
      if (!email.trim()) { toast.error("Please enter email!"); return false; }
      if (password.length < 6) { toast.error("Password must be 6+ characters!"); return false; }
      if (password !== confirmPassword) { toast.error("Passwords don't match!"); return false; }
      return true;
    }
    if (currentStep === 3) {
      if (!village.trim()) { toast.error("Please enter your village!"); return false; }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setCurrentStep((s) => s + 1);
  };

  const prevStep = () => setCurrentStep((s) => s - 1);

  const handleRegister = async () => {
    if (!validateStep()) return;
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, email, password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        phone,
        village,
        farmSize: farmSize || "Not specified",
        cropType: cropType.length > 0 ? cropType : ["Not specified"],
        role: "farmer",
        createdAt: new Date(),
      });

      setCompleted(true);
      toast.success("Account created successfully! 🌾");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        toast.error("Email already registered!");
      } else {
        toast.error("Something went wrong. Try again!");
      }
    }
    setLoading(false);
  };

  const focusStyle = (e) => {
    e.target.style.borderColor = "#52b788";
    e.target.style.boxShadow = "0 0 0 3px #d8f3dc";
  };
  const blurStyle = (e) => {
    e.target.style.borderColor = "#dde8e2";
    e.target.style.boxShadow = "none";
  };

  // ── Success screen ──
  if (completed) {
    return (
      <div style={styles.root}>
        <Toaster position="top-center" toastOptions={toastOpts} />
        <div style={styles.texture} />
        <motion.div
          style={styles.successCard}
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 300 }}
            style={styles.successIconWrap}
          >
            <CheckCircle2 size={40} color="#2d6a4f" strokeWidth={2} />
          </motion.div>
          <h2 style={styles.successTitle}>Welcome to KrishiSetu!</h2>
          <p style={styles.successSubtitle}>
            Your farmer account has been created.<br />Redirecting to login…
          </p>
          <div style={styles.successBarTrack}>
            <motion.div
              style={styles.successBarFill}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.5, ease: "linear" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <Toaster position="top-center" toastOptions={toastOpts} />
      <div style={styles.texture} />

      <div style={styles.wrapper}>

        {/* ── LEFT ── */}
        <motion.div
          style={styles.left}
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Wordmark */}
          <div style={styles.wordmark}>
            <div style={styles.logoMark}>
              <Leaf size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={styles.wordmarkText}>KrishiSetu</span>
          </div>

          <p style={styles.eyebrow}>Farmer Registration</p>
          <h1 style={styles.headline}>
            Join the<br />
            <em style={styles.headlineEm}>farming</em><br />
            revolution.
          </h1>
          <p style={styles.body}>
            Register and get access to skilled agricultural labour at your fingertips — GPS-verified, dual-confirmed, and transparent.
          </p>

          {/* Step tracker */}
          <div style={styles.stepsTrack}>
            {steps.map((step, i) => {
              const done = currentStep > step.id;
              const active = currentStep === step.id;
              return (
                <motion.div
                  key={step.id}
                  style={styles.stepRow}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <div style={styles.stepLeft}>
                    <div style={{
                      ...styles.stepDot,
                      backgroundColor: done ? "#2d6a4f" : active ? "#d8f3dc" : "#f0f4f2",
                      borderColor: done || active ? "#2d6a4f" : "#d0ddd8",
                    }}>
                      {done
                        ? <CheckCircle2 size={13} color="#fff" strokeWidth={3} />
                        : <span style={{ ...styles.stepNum, color: active ? "#2d6a4f" : "#a0bcaf" }}>{step.id}</span>
                      }
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{
                        ...styles.stepLine,
                        backgroundColor: currentStep > step.id ? "#52b788" : "#e4ede8",
                      }} />
                    )}
                  </div>
                  <div style={styles.stepInfo}>
                    <p style={{ ...styles.stepTitle, color: active ? "#1b4332" : done ? "#2d6a4f" : "#a0bcaf" }}>
                      {step.title}
                    </p>
                    <p style={styles.stepSub}>{step.subtitle}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <button style={styles.backBtn} onClick={() => navigate("/login")}>
            <ChevronLeft size={13} strokeWidth={2.5} />
            Back to login
          </button>
        </motion.div>

        {/* ── RIGHT ── */}
        <motion.div
          style={styles.right}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={styles.card}>

            {/* Step badge + progress */}
            <div style={styles.cardTopRow}>
              <span style={styles.stepBadge}>Step {currentStep} of {steps.length}</span>
              <div style={styles.progressTrack}>
                <motion.div
                  style={styles.progressFill}
                  initial={{ width: `${((currentStep - 1) / steps.length) * 100}%` }}
                  animate={{ width: `${(currentStep / steps.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>{steps[currentStep - 1].title}</h2>
              <p style={styles.cardSub}>{steps[currentStep - 1].subtitle}</p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 14 }}
                transition={{ duration: 0.25 }}
              >

                {/* ── Step 1 ── */}
                {currentStep === 1 && (
                  <div style={styles.fields}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Full name</label>
                      <div style={styles.inputWrap}>
                        <User size={14} color="#8aab97" style={styles.fieldIcon} />
                        <input
                          style={styles.input}
                          type="text"
                          placeholder="Your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </div>
                    </div>

                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Mobile number</label>
                      <div style={styles.inputWrap}>
                        <Phone size={14} color="#8aab97" style={styles.fieldIcon} />
                        <input
                          style={styles.input}
                          type="tel"
                          placeholder="10 digit phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          maxLength={10}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </div>
                      {phone.length > 0 && (
                        <motion.div
                          style={styles.phoneRow}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div style={styles.phoneMeterTrack}>
                            <motion.div
                              style={{
                                ...styles.phoneMeterFill,
                                backgroundColor: phone.length === 10 ? "#2d6a4f" : "#f59e0b",
                              }}
                              animate={{ width: `${(phone.length / 10) * 100}%` }}
                              transition={{ duration: 0.15 }}
                            />
                          </div>
                          <span style={{ ...styles.phoneCount, color: phone.length === 10 ? "#2d6a4f" : "#f59e0b" }}>
                            {phone.length}/10
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 2 ── */}
                {currentStep === 2 && (
                  <div style={styles.fields}>
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
                          onFocus={focusStyle}
                          onBlur={blurStyle}
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
                          placeholder="Minimum 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </div>
                    </div>

                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Confirm password</label>
                      <div style={styles.inputWrap}>
                        <Lock size={14} color="#8aab97" style={styles.fieldIcon} />
                        <input
                          style={{
                            ...styles.input,
                            borderColor: confirmPassword
                              ? password === confirmPassword ? "#52b788" : "#dc2626"
                              : "#dde8e2",
                          }}
                          type="password"
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onFocus={(e) => { e.target.style.boxShadow = "0 0 0 3px #d8f3dc"; }}
                          onBlur={(e) => { e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                      {confirmPassword.length > 0 && (
                        <motion.p
                          style={{
                            fontSize: "12px",
                            marginTop: "6px",
                            marginBottom: 0,
                            fontWeight: "500",
                            color: password === confirmPassword ? "#2d6a4f" : "#dc2626",
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords don't match"}
                        </motion.p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 3 ── */}
                {currentStep === 3 && (
                  <div style={styles.fields}>
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Village / Town</label>
                      <div style={styles.inputWrap}>
                        <MapPin size={14} color="#8aab97" style={styles.fieldIcon} />
                        <input
                          style={styles.input}
                          type="text"
                          placeholder="Village or town name"
                          value={village}
                          onChange={(e) => setVillage(e.target.value)}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </div>
                    </div>

                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Farm size</label>
                      <div style={styles.inputWrap}>
                        <MapPin size={14} color="#8aab97" style={styles.fieldIcon} />
                        <select
                          style={{ ...styles.input, color: farmSize ? "#1a1a1a" : "#8aab97" }}
                          value={farmSize}
                          onChange={(e) => setFarmSize(e.target.value)}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        >
                          <option value="">Select farm size (acres)</option>
                          <option value="small">Small — 1 to 5 acres</option>
                          <option value="medium">Medium — 5 to 20 acres</option>
                          <option value="large">Large — 20+ acres</option>
                        </select>
                      </div>
                    </div>

                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>
                        <Sprout size={13} color="#52b788" style={{ marginRight: "5px", verticalAlign: "middle" }} />
                        Crop types <span style={{ color: "#a0bcaf", fontWeight: 400 }}>(select all that apply)</span>
                      </label>
                      <div style={styles.cropGrid}>
                        {[
                          { value: "rice", label: "🌾 Rice" },
                          { value: "wheat", label: "🌿 Wheat" },
                          { value: "sugarcane", label: "🎋 Sugarcane" },
                          { value: "cotton", label: "🌸 Cotton" },
                          { value: "vegetables", label: "🥦 Vegetables" },
                          { value: "fruits", label: "🍎 Fruits" },
                          { value: "pulses", label: "🫘 Pulses" },
                          { value: "other", label: "📝 Other" },
                        ].map((crop) => {
                          const sel = cropType.includes(crop.value);
                          return (
                            <motion.button
                              key={crop.value}
                              type="button"
                              style={{
                                ...styles.cropBtn,
                                backgroundColor: sel ? "#f4fdf6" : "#fafcfb",
                                borderColor: sel ? "#52b788" : "#dde8e2",
                                color: sel ? "#2d6a4f" : "#5c7a6b",
                              }}
                              onClick={() =>
                                setCropType(
                                  sel
                                    ? cropType.filter((c) => c !== crop.value)
                                    : [...cropType, crop.value]
                                )
                              }
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <span>{crop.label}</span>
                              {sel && <span style={styles.cropTick}>✓</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary */}
                    <motion.div
                      style={styles.summary}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p style={styles.summaryHeading}>Account summary</p>
                      <div style={styles.summaryGrid}>
                        <span style={styles.summaryKey}>Name</span>
                        <span style={styles.summaryVal}>{name || "—"}</span>
                        <span style={styles.summaryKey}>Phone</span>
                        <span style={styles.summaryVal}>{phone || "—"}</span>
                        <span style={styles.summaryKey}>Email</span>
                        <span style={styles.summaryVal}>{email || "—"}</span>
                        {cropType.length > 0 && (
                          <>
                            <span style={styles.summaryKey}>Crops</span>
                            <span style={styles.summaryVal}>{cropType.join(", ")}</span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Nav buttons */}
            <div style={styles.navRow}>
              {currentStep > 1 && (
                <motion.button
                  style={styles.prevBtn}
                  onClick={prevStep}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                  Back
                </motion.button>
              )}

              {currentStep < steps.length ? (
                <motion.button
                  style={styles.nextBtn}
                  onClick={nextStep}
                  whileHover={{ opacity: 0.92, y: -1 }}
                  whileTap={{ scale: 0.985 }}
                >
                  Continue
                  <ChevronRight size={16} strokeWidth={2.5} />
                </motion.button>
              ) : (
                <motion.button
                  style={styles.submitBtn}
                  onClick={handleRegister}
                  disabled={loading}
                  whileHover={{ opacity: 0.92, y: -1 }}
                  whileTap={{ scale: 0.985 }}
                >
                  {loading ? (
                    <motion.div
                      style={styles.spinner}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
                    />
                  ) : (
                    <>
                      <Sprout size={16} strokeWidth={2.2} />
                      Create Farmer Account
                    </>
                  )}
                </motion.button>
              )}
            </div>

          </div>
        </motion.div>

      </div>
    </div>
  );
}

const toastOpts = {
  style: {
    fontFamily: "'Poppins', sans-serif",
    fontSize: "13px",
    borderRadius: "10px",
    border: "1px solid #e8f5e9",
    boxShadow: "0 4px 20px rgba(27,67,50,0.08)",
  },
};

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
    backgroundImage: `radial-gradient(circle at 75% 8%, rgba(82,183,136,0.07) 0%, transparent 52%),
                      radial-gradient(circle at 8% 85%, rgba(45,106,79,0.04) 0%, transparent 48%)`,
    pointerEvents: "none",
    zIndex: 0,
  },
  wrapper: {
    display: "flex",
    alignItems: "flex-start",
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
    flex: "0 0 360px",
    minWidth: "260px",
    paddingTop: "8px",
  },
  wordmark: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "44px",
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
  eyebrow: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#52b788",
    letterSpacing: "2px",
    textTransform: "uppercase",
    margin: "0 0 12px 0",
  },
  headline: {
    fontSize: "40px",
    fontWeight: "800",
    color: "#1b4332",
    lineHeight: 1.18,
    margin: "0 0 16px 0",
    letterSpacing: "-1.5px",
  },
  headlineEm: {
    fontStyle: "italic",
    color: "#2d6a4f",
  },
  body: {
    fontSize: "14px",
    color: "#5c7a6b",
    lineHeight: 1.75,
    margin: "0 0 40px 0",
  },

  /* Step tracker */
  stepsTrack: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "36px",
  },
  stepRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
  },
  stepLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  stepDot: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    border: "1.5px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNum: {
    fontSize: "12px",
    fontWeight: "700",
  },
  stepLine: {
    width: "1.5px",
    height: "28px",
    marginTop: "3px",
  },
  stepInfo: {
    paddingTop: "4px",
    paddingBottom: "20px",
  },
  stepTitle: {
    fontSize: "13px",
    fontWeight: "700",
    margin: "0 0 2px 0",
    letterSpacing: "-0.2px",
  },
  stepSub: {
    fontSize: "12px",
    color: "#a0bcaf",
    margin: 0,
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "transparent",
    border: "none",
    color: "#8aab97",
    cursor: "pointer",
    fontSize: "12.5px",
    fontWeight: "500",
    fontFamily: "'Poppins', sans-serif",
    padding: 0,
  },

  /* ── RIGHT ── */
  right: {
    flex: "0 0 400px",
    minWidth: "300px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    border: "1px solid #e4ede8",
    padding: "32px 30px 28px",
    boxShadow: "0 4px 32px rgba(27,67,50,0.07), 0 1px 4px rgba(27,67,50,0.04)",
  },
  cardTopRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "20px",
  },
  stepBadge: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#2d6a4f",
    backgroundColor: "#eef7f1",
    border: "1px solid #b7e4c7",
    borderRadius: "20px",
    padding: "3px 11px",
    whiteSpace: "nowrap",
    letterSpacing: "0.3px",
  },
  progressTrack: {
    flex: 1,
    height: "3px",
    backgroundColor: "#e8f0eb",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#52b788",
    borderRadius: "2px",
  },
  cardHeader: {
    marginBottom: "22px",
  },
  cardTitle: {
    fontSize: "21px",
    fontWeight: "800",
    color: "#1b4332",
    margin: "0 0 4px",
    letterSpacing: "-0.5px",
  },
  cardSub: {
    fontSize: "13px",
    color: "#8aab97",
    margin: 0,
  },

  /* Fields */
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#3d6352",
    marginBottom: "7px",
    display: "block",
    letterSpacing: "0.1px",
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
    appearance: "none",
    WebkitAppearance: "none",
  },

  /* Phone meter */
  phoneRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "7px",
  },
  phoneMeterTrack: {
    flex: 1,
    height: "3px",
    backgroundColor: "#e8f0eb",
    borderRadius: "2px",
    overflow: "hidden",
  },
  phoneMeterFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.15s",
  },
  phoneCount: {
    fontSize: "11px",
    fontWeight: "700",
    minWidth: "28px",
  },

  /* Crop grid */
  cropGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "7px",
    marginTop: "4px",
  },
  cropBtn: {
    padding: "9px 12px",
    borderRadius: "9px",
    border: "1.5px solid",
    cursor: "pointer",
    fontSize: "12.5px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontFamily: "'Poppins', sans-serif",
    transition: "border-color 0.15s, background-color 0.15s",
  },
  cropTick: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#2d6a4f",
  },

  /* Summary */
  summary: {
    backgroundColor: "#f4fdf6",
    border: "1px solid #b7e4c7",
    borderRadius: "12px",
    padding: "16px",
  },
  summaryHeading: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#2d6a4f",
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 12px 0",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "5px 16px",
  },
  summaryKey: {
    fontSize: "12px",
    color: "#8aab97",
    fontWeight: "500",
  },
  summaryVal: {
    fontSize: "12px",
    color: "#1b4332",
    fontWeight: "600",
    wordBreak: "break-all",
  },

  /* Nav */
  navRow: {
    display: "flex",
    gap: "10px",
    marginTop: "26px",
  },
  prevBtn: {
    flex: 1,
    padding: "12px",
    backgroundColor: "transparent",
    border: "1.5px solid #dde8e2",
    borderRadius: "10px",
    color: "#5c7a6b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    fontSize: "13px",
    fontWeight: "600",
    fontFamily: "'Poppins', sans-serif",
  },
  nextBtn: {
    flex: 2,
    padding: "12px",
    background: "linear-gradient(135deg, #52b788, #2d6a4f)",
    border: "none",
    borderRadius: "10px",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "13.5px",
    fontWeight: "700",
    fontFamily: "'Poppins', sans-serif",
    boxShadow: "0 4px 18px rgba(45,106,79,0.22)",
    letterSpacing: "0.1px",
  },
  submitBtn: {
    flex: 2,
    padding: "12px",
    background: "linear-gradient(135deg, #52b788, #1b4332)",
    border: "none",
    borderRadius: "10px",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    fontSize: "13.5px",
    fontWeight: "700",
    fontFamily: "'Poppins', sans-serif",
    boxShadow: "0 4px 18px rgba(45,106,79,0.25)",
    letterSpacing: "0.1px",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #ffffff",
    borderRadius: "50%",
  },

  /* Success */
  successCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #b7e4c7",
    borderRadius: "20px",
    padding: "48px 40px",
    textAlign: "center",
    maxWidth: "380px",
    width: "90%",
    position: "relative",
    zIndex: 1,
    boxShadow: "0 8px 40px rgba(27,67,50,0.1)",
  },
  successIconWrap: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#eef7f1",
    border: "1px solid #b7e4c7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
  },
  successTitle: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#1b4332",
    margin: "0 0 10px",
    letterSpacing: "-0.5px",
  },
  successSubtitle: {
    fontSize: "14px",
    color: "#5c7a6b",
    margin: "0 0 28px",
    lineHeight: 1.65,
  },
  successBarTrack: {
    height: "3px",
    backgroundColor: "#d8f3dc",
    borderRadius: "2px",
    overflow: "hidden",
  },
  successBarFill: {
    height: "100%",
    backgroundColor: "#2d6a4f",
    borderRadius: "2px",
  },
};

export default FarmerRegister;