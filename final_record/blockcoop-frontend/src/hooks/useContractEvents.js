import { useState, useEffect } from 'react';
import { contractService } from '../services/contractService';

const useContractEvents = (eventName) => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        // Get the contract instance
        if (!contractService.contract) {
          await contractService.init();
        }

        // Get past events
        const filter = contractService.contract.filters[eventName]();
        const pastEvents = await contractService.contract.queryFilter(filter);
        const sortedEvents = [...pastEvents].reverse();
        setEvents(sortedEvents); // Most recent first

        // Listen for new events
        contractService.contract.on(eventName, (...args) => {
          const event = args[args.length - 1]; // Last argument is the event object
          setEvents(prev => [event, ...prev]);
        });

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();

    // Cleanup
    return () => {
      if (contractService.contract) {
        contractService.contract.removeAllListeners(eventName);
      }
    };
  }, [eventName]);

  return { events, isLoading, error };
};

export const useFundManagerAddedEvents = () => useContractEvents('FundManagerAdded');
export const useFundManagerRemovedEvents = () => useContractEvents('FundManagerRemoved');
export const useTokenWhitelistedEvents = () => useContractEvents('TokenWhitelisted');
