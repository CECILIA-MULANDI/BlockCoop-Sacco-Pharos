import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import FundManagerDashboard from "./pages/fund-manager/FundManagerDashboard";
import UserDashboard from "./pages/user/UserDashboard";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />

        {/* Owner Routes */}
        <Route
          path="/owner-dashboard"
          element={
            <PrivateRoute element={<OwnerDashboard />} requiredRole="owner" />
          }
        >
          <Route index element={<OwnerDashboard />} />
          <Route path="managers" element={<OwnerDashboard />} />
          <Route path="tokens" element={<OwnerDashboard />} />
          <Route path="displayTokens" element={<OwnerDashboard />} />
          <Route path="tokenDistribution" element={<OwnerDashboard />} />
          <Route path="fundPool" element={<OwnerDashboard />} />
        </Route>

        {/* Fund Manager Routes */}
        <Route
          path="/fund-manager"
          element={
            <PrivateRoute
              element={<FundManagerDashboard />}
              requiredRole="fundManager"
            />
          }
        />

        {/* User Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute element={<UserDashboard />} requiredRole="user" />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
