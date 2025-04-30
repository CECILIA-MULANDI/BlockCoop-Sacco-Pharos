import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Header() {
  const navigate = useNavigate();
  const { isConnected, connect, disconnect } = useAuth();
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnectWallet = async () => {
    if (connecting) return;

    try {
      setConnecting(true);
      setError(null);

      const role = await connect();
      console.log("Connected with role:", role);

      // Navigate based on role
      if (role === "owner") {
        navigate("/owner-dashboard");
      } else if (role === "fundManager") {
        navigate("/fund-manager");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError(error.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/");
  };

  return (
    <header className="bg-gray-800 text-white py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="text-xl font-bold">BlockCoop</div>
        <div className="flex items-center gap-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Disconnect Wallet
            </button>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={connecting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
