import { useState, useCallback } from 'react';

export const useMessages = () => {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const displaySuccessMessage = useCallback((message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 5000); // Clear after 5 seconds
  }, []);

  const displayErrorMessage = useCallback((message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 5000); // Clear after 5 seconds
  }, []);

  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage('');
  }, []);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage('');
  }, []);

  return {
    successMessage,
    errorMessage,
    displaySuccessMessage,
    displayErrorMessage,
    clearSuccessMessage,
    clearErrorMessage
  };
};
