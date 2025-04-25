import { useState } from 'react';
import { contractService } from '../services/contractService';

export const useRemoveFundManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const removeManager = async (address) => {
    setIsLoading(true);
    setError(null);
    try {
      await contractService.contract.removeFundManager(address);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { removeManager, isLoading, error };
};
