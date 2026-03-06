import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./pages/Homepage";
import Login from "./pages/Login";
import FarmerRegister from "./pages/farmer/FarmerRegister";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

function App() {
  return (
    <Router>
      <Routes>
        {/* Homepage - first page users see */}
        <Route path="/" element={<Homepage />} />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<FarmerRegister />} />

        {/* Dashboards */}
        <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;