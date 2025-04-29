import { useState, useEffect, useCallback } from 'react';
import { contractService } from '../services/contractService';

export const useAddFundManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const addManager = useCallback(async (address) => {
    setIsLoading(true);
    setError(null);
    try {
      await contractService.addFundManager(address);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { addManager, isLoading, error };
};

export const useGetActiveFundManagers = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchManagers = useCallback(async () => {
    try {
      const managers = await contractService.contract.getAllActiveFundManagers();
      setData(managers);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  return { data, isLoading, error, refetch: fetchManagers };
};

export const useWhitelistToken = () => {
  const whitelistToken = useCallback(async (tokenAddress, priceFeed) => {
    return contractService.whitelistToken(tokenAddress, priceFeed);
  }, []);

  return { whitelistToken };
};

export const useGetWhitelistedTokens = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTokens = useCallback(async () => {
    try {
      const tokens = await contractService.getWhitelistedTokens();
      setData(tokens);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { data, isLoading, error, refetch: fetchTokens };
};
