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

  // Success screen
  if (completed) {
    return (
      <div style={styles.root}>
        <Toaster position="top-center" />
        <div style={styles.blob1} />
        <div style={styles.blob2} />
        <div style={styles.grid} />
        <motion.div
          style={styles.successCard}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          <motion.div
            style={styles.successIcon}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <CheckCircle2 size={48} color="#4ade80" />
          </motion.div>
          <h2 style={styles.successTitle}>Welcome to KrishiSetu!</h2>
          <p style={styles.successSubtitle}>
            Your farmer account has been created. Redirecting to login...
          </p>
          <motion.div
            style={styles.successBar}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5, ease: "linear" }}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <Toaster position="top-center" />

      {/* Background */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />
      <div style={styles.grid} />

      <div style={styles.wrapper}>
        {/* Left Panel */}
        <motion.div
          style={styles.leftPanel}
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Logo */}
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <Leaf size={28} color="#4ade80" />
            </div>
            <span style={styles.logoText}>KrishiSetu</span>
          </div>

          <h1 style={styles.heroTitle}>
            Join the
            <br />
            <span style={styles.heroAccent}>Farming</span>
            <br />
            Revolution
          </h1>

          <p style={styles.heroSubtitle}>
            Register as a farmer and get access to skilled agricultural
            labour at your fingertips.
          </p>

          {/* Steps Progress */}
          <div style={styles.stepsContainer}>
            {steps.map((step, index) => {
              const isDone = currentStep > step.id;
              const isActive = currentStep === step.id;
              return (
                <motion.div
                  key={step.id}
                  style={styles.stepItem}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.4 }}
                >
                  <div
                    style={{
                      ...styles.stepDot,
                      backgroundColor: isDone
                        ? "#4ade80"
                        : isActive
                        ? "rgba(74,222,128,0.2)"
                        : "rgba(255,255,255,0.05)",
                      border: `2px solid ${
                        isDone || isActive
                          ? "#4ade80"
                          : "rgba(255,255,255,0.1)"
                      }`,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={14} color="#080f0a" />
                    ) : (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          color: isActive ? "#4ade80" : "#444",
                        }}
                      >
                        {step.id}
                      </span>
                    )}
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      style={{
                        ...styles.stepConnector,
                        backgroundColor:
                          currentStep > step.id
                            ? "#4ade80"
                            : "rgba(255,255,255,0.08)",
                      }}
                    />
                  )}

                  <div style={styles.stepText}>
                    <p
                      style={{
                        ...styles.stepTitle,
                        color: isActive
                          ? "#fff"
                          : isDone
                          ? "#4ade80"
                          : "#444",
                      }}
                    >
                      {step.title}
                    </p>
                    <p style={styles.stepSubtitle}>{step.subtitle}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.button
            style={styles.backToLogin}
            onClick={() => navigate("/login")}
            whileHover={{ x: -4 }}
          >
            <ChevronLeft size={14} />
            Back to login
          </motion.button>
        </motion.div>

        {/* Right Panel */}
        <motion.div
          style={styles.rightPanel}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div style={styles.formCard}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.3 }}
              >
                {/* Step Header */}
                <div style={styles.stepHeader}>
                  <div style={styles.stepBadge}>
                    Step {currentStep} of {steps.length}
                  </div>
                  <h2 style={styles.formTitle}>
                    {steps[currentStep - 1].title}
                  </h2>
                  <p style={styles.formSubtitle}>
                    {steps[currentStep - 1].subtitle}
                  </p>
                </div>

                {/* Progress bar */}
                <div style={styles.progressBar}>
                  <motion.div
                    style={styles.progressFill}
                    initial={{
                      width: `${((currentStep - 1) / steps.length) * 100}%`,
                    }}
                    animate={{
                      width: `${(currentStep / steps.length) * 100}%`,
                    }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                {/* Step 1 - Personal Info */}
                {currentStep === 1 && (
                  <div style={styles.fieldsContainer}>
                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <User size={16} color="#555" />
                      </div>
                      <input
                        style={styles.input}
                        type="text"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <Phone size={16} color="#555" />
                      </div>
                      <input
                        style={styles.input}
                        type="tel"
                        placeholder="10 digit phone number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={10}
                      />
                    </div>

                    {phone.length > 0 && (
                      <motion.div
                        style={styles.phoneProgress}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div style={styles.phoneProgressBar}>
                          <motion.div
                            style={{
                              ...styles.phoneProgressFill,
                              backgroundColor:
                                phone.length === 10 ? "#4ade80" : "#f59e0b",
                            }}
                            animate={{
                              width: `${(phone.length / 10) * 100}%`,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            ...styles.phoneCount,
                            color:
                              phone.length === 10 ? "#4ade80" : "#f59e0b",
                          }}
                        >
                          {phone.length}/10
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Step 2 - Account Setup */}
                {currentStep === 2 && (
                  <div style={styles.fieldsContainer}>
                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <Mail size={16} color="#555" />
                      </div>
                      <input
                        style={styles.input}
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <Lock size={16} color="#555" />
                      </div>
                      <input
                        style={styles.input}
                        type="password"
                        placeholder="Create password (min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <Lock size={16} color="#555" />
                      </div>
                      <input
                        style={{
                          ...styles.input,
                          borderColor:
                            confirmPassword &&
                            password !== confirmPassword
                              ? "rgba(239,68,68,0.5)"
                              : confirmPassword &&
                                password === confirmPassword
                              ? "rgba(74,222,128,0.5)"
                              : "rgba(255,255,255,0.08)",
                        }}
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    {confirmPassword.length > 0 && (
                      <motion.p
                        style={{
                          fontSize: "12px",
                          margin: "-8px 0 0 0",
                          color:
                            password === confirmPassword
                              ? "#4ade80"
                              : "#ef4444",
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {password === confirmPassword
                          ? "✅ Passwords match!"
                          : "❌ Passwords don't match"}
                      </motion.p>
                    )}
                  </div>
                )}

                {/* Step 3 - Farm Details */}
                {currentStep === 3 && (
                  <div style={styles.fieldsContainer}>
                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <MapPin size={16} color="#555" />
                      </div>
                      <input
                        style={styles.input}
                        type="text"
                        placeholder="Village / Town name"
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                      />
                    </div>

                    {/* Farm Size */}
                    <div style={styles.inputGroup}>
                      <div style={styles.inputIcon}>
                        <MapPin size={16} color="#555" />
                      </div>
                      <select
                        style={{
                          ...styles.input,
                          color: farmSize ? "#fff" : "#555",
                        }}
                        value={farmSize}
                        onChange={(e) => setFarmSize(e.target.value)}
                      >
                        <option value="" style={{ backgroundColor: "#0d1a11", color: "#888" }}>
                          Farm size (acres)
                        </option>
                        <option value="small" style={{ backgroundColor: "#0d1a11", color: "#fff" }}>
                          Small (1-5 acres)
                        </option>
                        <option value="medium" style={{ backgroundColor: "#0d1a11", color: "#fff" }}>
                          Medium (5-20 acres)
                        </option>
                        <option value="large" style={{ backgroundColor: "#0d1a11", color: "#fff" }}>
                          Large (20+ acres)
                        </option>
                      </select>
                    </div>

                    {/* Multi-select Crop Types */}
                    <div>
                      <p style={styles.cropLabel}>
                        <Sprout size={14} color="#4ade80" />
                        &nbsp; Select Crop Types (tap multiple)
                      </p>
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
                          const isSelected = cropType.includes(crop.value);
                          return (
                            <motion.button
                              key={crop.value}
                              type="button"
                              style={{
                                ...styles.cropBtn,
                                backgroundColor: isSelected
                                  ? "rgba(74,222,128,0.15)"
                                  : "rgba(255,255,255,0.03)",
                                border: `1.5px solid ${
                                  isSelected
                                    ? "rgba(74,222,128,0.5)"
                                    : "rgba(255,255,255,0.08)"
                                }`,
                                color: isSelected ? "#4ade80" : "#666",
                              }}
                              onClick={() => {
                                if (cropType.includes(crop.value)) {
                                  setCropType(
                                    cropType.filter((c) => c !== crop.value)
                                  );
                                } else {
                                  setCropType([...cropType, crop.value]);
                                }
                              }}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                            >
                              {crop.label}
                              {isSelected && (
                                <span style={styles.cropCheck}>✓</span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary */}
                    <motion.div
                      style={styles.summaryBox}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p style={styles.summaryTitle}>📋 Account Summary</p>
                      <p style={styles.summaryItem}>👤 {name}</p>
                      <p style={styles.summaryItem}>📞 {phone}</p>
                      <p style={styles.summaryItem}>📧 {email}</p>
                      {cropType.length > 0 && (
                        <p style={styles.summaryItem}>
                          🌾 Crops: {cropType.join(", ")}
                        </p>
                      )}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div style={styles.navButtons}>
              {currentStep > 1 && (
                <motion.button
                  style={styles.prevBtn}
                  onClick={prevStep}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ChevronLeft size={18} />
                  Back
                </motion.button>
              )}

              {currentStep < steps.length ? (
                <motion.button
                  style={styles.nextBtn}
                  onClick={nextStep}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue
                  <ChevronRight size={18} />
                </motion.button>
              ) : (
                <motion.button
                  style={styles.submitBtn}
                  onClick={handleRegister}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <motion.div
                      style={styles.spinner}
                      animate={{ rotate: 360 }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        ease: "linear",
                      }}
                    />
                  ) : (
                    <>
                      <Sprout size={18} />
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

const styles = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#080f0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Georgia', serif",
  },
  blob1: {
    position: "absolute",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)",
    top: "-200px",
    left: "-200px",
    pointerEvents: "none",
  },
  blob2: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)",
    bottom: "-150px",
    right: "-100px",
    pointerEvents: "none",
  },
  blob3: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)",
    top: "50%",
    right: "30%",
    pointerEvents: "none",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px)
    `,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "80px",
    padding: "40px 24px",
    width: "100%",
    maxWidth: "1100px",
    position: "relative",
    zIndex: 1,
    flexWrap: "wrap",
  },
  leftPanel: {
    flex: 1,
    minWidth: "280px",
    maxWidth: "380px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "40px",
  },
  logoIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    backgroundColor: "rgba(74,222,128,0.1)",
    border: "1px solid rgba(74,222,128,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "-0.5px",
  },
  heroTitle: {
    fontSize: "48px",
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 1.1,
    margin: "0 0 20px 0",
    letterSpacing: "-2px",
  },
  heroAccent: {
    color: "#4ade80",
    fontStyle: "italic",
  },
  heroSubtitle: {
    fontSize: "15px",
    color: "#666",
    lineHeight: 1.7,
    margin: "0 0 40px 0",
  },
  stepsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
    marginBottom: "40px",
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    position: "relative",
  },
  stepDot: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    zIndex: 1,
  },
  stepConnector: {
    position: "absolute",
    left: "15px",
    top: "32px",
    width: "2px",
    height: "32px",
  },
  stepText: {
    paddingBottom: "28px",
  },
  stepTitle: {
    fontSize: "14px",
    fontWeight: "700",
    margin: "6px 0 2px 0",
    letterSpacing: "-0.3px",
  },
  stepSubtitle: {
    fontSize: "12px",
    color: "#444",
    margin: 0,
  },
  backToLogin: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "transparent",
    border: "none",
    color: "#555",
    cursor: "pointer",
    fontSize: "13px",
    padding: 0,
  },
  rightPanel: {
    flex: 1,
    minWidth: "320px",
    maxWidth: "440px",
  },
  formCard: {
    backgroundColor: "#0d1a11",
    border: "1px solid rgba(74,222,128,0.1)",
    borderRadius: "24px",
    padding: "36px",
    boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
  },
  stepHeader: {
    marginBottom: "20px",
  },
  stepBadge: {
    display: "inline-block",
    backgroundColor: "rgba(74,222,128,0.1)",
    border: "1px solid rgba(74,222,128,0.2)",
    color: "#4ade80",
    fontSize: "11px",
    fontWeight: "700",
    padding: "4px 12px",
    borderRadius: "20px",
    marginBottom: "12px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  formTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 4px 0",
    letterSpacing: "-0.5px",
  },
  formSubtitle: {
    fontSize: "13px",
    color: "#555",
    margin: "0 0 20px 0",
  },
  progressBar: {
    height: "3px",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "2px",
    marginBottom: "28px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4ade80",
    borderRadius: "2px",
  },
  fieldsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  inputGroup: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    zIndex: 1,
  },
  input: {
    width: "100%",
    padding: "14px 14px 14px 42px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    fontSize: "14px",
    color: "#ffffff",
    boxSizing: "border-box",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
  },
  phoneProgress: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "-6px",
  },
  phoneProgressBar: {
    flex: 1,
    height: "3px",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  phoneProgressFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.2s",
  },
  phoneCount: {
    fontSize: "11px",
    fontWeight: "700",
    minWidth: "30px",
  },
  cropLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: "13px",
    color: "#888",
    margin: "0 0 10px 0",
    fontWeight: "600",
  },
  cropGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  cropBtn: {
    padding: "10px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    transition: "all 0.2s",
  },
  cropCheck: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#4ade80",
  },
  summaryBox: {
    backgroundColor: "rgba(74,222,128,0.05)",
    border: "1px solid rgba(74,222,128,0.1)",
    borderRadius: "12px",
    padding: "16px",
    marginTop: "8px",
  },
  summaryTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#4ade80",
    margin: "0 0 10px 0",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  summaryItem: {
    fontSize: "13px",
    color: "#888",
    margin: "4px 0",
  },
  navButtons: {
    display: "flex",
    gap: "12px",
    marginTop: "28px",
  },
  prevBtn: {
    flex: 1,
    padding: "13px",
    backgroundColor: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#666",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "14px",
    fontWeight: "600",
  },
  nextBtn: {
    flex: 2,
    padding: "13px",
    backgroundColor: "rgba(74,222,128,0.15)",
    border: "1px solid rgba(74,222,128,0.3)",
    borderRadius: "12px",
    color: "#4ade80",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "14px",
    fontWeight: "700",
  },
  submitBtn: {
    flex: 2,
    padding: "13px",
    background: "linear-gradient(135deg, #4ade80, #22c55e)",
    border: "none",
    borderRadius: "12px",
    color: "#080f0a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: "800",
    letterSpacing: "-0.3px",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(0,0,0,0.2)",
    borderTop: "2px solid #080f0a",
    borderRadius: "50%",
  },
  successCard: {
    backgroundColor: "#0d1a11",
    border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: "24px",
    padding: "48px",
    textAlign: "center",
    maxWidth: "400px",
    width: "90%",
    position: "relative",
    zIndex: 1,
    overflow: "hidden",
  },
  successIcon: {
    marginBottom: "20px",
  },
  successTitle: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "0 0 12px 0",
    letterSpacing: "-0.5px",
  },
  successSubtitle: {
    fontSize: "14px",
    color: "#666",
    margin: "0 0 28px 0",
    lineHeight: 1.6,
  },
  successBar: {
    height: "3px",
    backgroundColor: "#4ade80",
    borderRadius: "2px",
  },
};

export default FarmerRegister;