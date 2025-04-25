import { useState, useEffect } from "react";
import { contractService } from "../services/contractService";

export function useAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = async () => {
    try {
      if (!window.ethereum) {
        setLoading(false);
        return false;
      }

      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        await contractService.init();
        const role = await contractService.checkRole();
        setUserRole(role);
        setIsConnected(true);
        localStorage.setItem("userRole", role);
        localStorage.setItem("isConnected", "true");
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error checking connection:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to connect");
      }

      // Request account access using eth_requestAccounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      }).catch((error) => {
        if (error.code === 4001) {
          throw new Error("Please connect your wallet to continue");
        }
        throw error;
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please check MetaMask");
      }

      // Initialize contract and check role
      await contractService.init();
      const role = await contractService.checkRole();
      
      setUserRole(role);
      setIsConnected(true);
      localStorage.setItem("userRole", role);
      localStorage.setItem("isConnected", "true");
      
      return role;
    } catch (error) {
      console.error("Error connecting:", error);
      setIsConnected(false);
      localStorage.removeItem("userRole");
      localStorage.setItem("isConnected", "false");
      throw error;
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setUserRole(null);
    localStorage.removeItem("userRole");
    localStorage.setItem("isConnected", "false");
  };

  useEffect(() => {
    const init = async () => {
      const storedIsConnected = localStorage.getItem("isConnected") === "true";
      const storedRole = localStorage.getItem("userRole");

      if (storedIsConnected && storedRole) {
        const isStillConnected = await checkConnection();
        if (!isStillConnected) {
          disconnect();
        }
      } else {
        setLoading(false);
      }
    };

    init();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => {
        window.location.reload();
      });
    }
  }, []);

  return {
    isConnected,
    userRole,
    loading,
    connect,
    disconnect,
  };
}
