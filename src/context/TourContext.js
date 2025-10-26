import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TourContext = createContext();

const TOUR_STORAGE_KEY = '@nichtarm_tour_completed';
const TOUR_PROGRESS_KEY = '@nichtarm_tour_progress';

export const TourProvider = ({ children }) => {
  const [isTourActive, setIsTourActive] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedActions, setCompletedActions] = useState({
    cardCreated: false,
    categoryCreated: false,
    planCreated: false,
  });

  // Tour Steps Configuration
  const tourSteps = [
    {
      id: 'welcome',
      title: 'Welcome to Nichtarm!',
      description: 'We will guide you step by step to set up your account and start managing your finances.',
      screen: 'Home',
      action: 'createCard',
    },
    {
      id: 'createCard',
      title: 'Create your first card',
      description: 'Cards help you organize your expenses. They can be physical or virtual.',
      screen: 'CreateCard',
      action: 'createCard',
    },
    {
      id: 'createCategory',
      title: 'Create your first category',
      description: 'Categories help you classify your expenses and income.',
      screen: 'CreateCategory',
      action: 'createCategory',
    },
    {
      id: 'createPlan',
      title: 'Create your first plan',
      description: 'Plans help you save and reach your financial goals.',
      screen: 'CreatePlan',
      action: 'createPlan',
    },
    {
      id: 'completion',
      title: 'Congratulations!',
      description: 'You have completed the basic setup! Now explore more features like budgets, analysis and more.',
      screen: 'Home',
      action: 'complete',
    },
  ];

  // Load tour state on mount
  useEffect(() => {
    loadTourState();
  }, []);

  const loadTourState = async () => {
    try {
      const completed = await AsyncStorage.getItem(TOUR_STORAGE_KEY);
      const progress = await AsyncStorage.getItem(TOUR_PROGRESS_KEY);
      
      if (completed === 'true') {
        setIsTourCompleted(true);
        setIsTourActive(false);
      }
      
      if (progress) {
        const parsedProgress = JSON.parse(progress);
        setCurrentStep(parsedProgress.currentStep || 0);
        setCompletedActions(parsedProgress.completedActions || {
          cardCreated: false,
          categoryCreated: false,
          planCreated: false,
        });
      }
    } catch (error) {
      console.error('Error loading tour state:', error);
    }
  };

  const saveTourProgress = async (step, actions) => {
    try {
      await AsyncStorage.setItem(TOUR_PROGRESS_KEY, JSON.stringify({
        currentStep: step,
        completedActions: actions,
      }));
    } catch (error) {
      console.error('Error saving tour progress:', error);
    }
  };

  const startTour = () => {
    setIsTourActive(true);
    setCurrentStep(0);
    setCompletedActions({
      cardCreated: false,
      categoryCreated: false,
      planCreated: false,
    });
  };

  const nextStep = () => {
    const newStep = currentStep + 1;
    if (newStep < tourSteps.length) {
      setCurrentStep(newStep);
      saveTourProgress(newStep, completedActions);
    } else {
      completeTour();
    }
  };

  const skipTour = async () => {
    setIsTourActive(false);
    setIsTourCompleted(true);
    try {
      await AsyncStorage.setItem(TOUR_STORAGE_KEY, 'true');
      await AsyncStorage.removeItem(TOUR_PROGRESS_KEY);
    } catch (error) {
      console.error('Error skipping tour:', error);
    }
  };

  const completeTour = async () => {
    setIsTourActive(false);
    setIsTourCompleted(true);
    try {
      await AsyncStorage.setItem(TOUR_STORAGE_KEY, 'true');
      await AsyncStorage.removeItem(TOUR_PROGRESS_KEY);
    } catch (error) {
      console.error('Error completing tour:', error);
    }
  };

  const completeAction = (action) => {
    const newActions = { ...completedActions, [action]: true };
    setCompletedActions(newActions);
    saveTourProgress(currentStep, newActions);
  };

  const resetTour = async () => {
    try {
      await AsyncStorage.removeItem(TOUR_STORAGE_KEY);
      await AsyncStorage.removeItem(TOUR_PROGRESS_KEY);
      setIsTourCompleted(false);
      setIsTourActive(false);
      setCurrentStep(0);
      setCompletedActions({
        cardCreated: false,
        categoryCreated: false,
        planCreated: false,
      });
    } catch (error) {
      console.error('Error resetting tour:', error);
    }
  };

  const value = {
    isTourActive,
    isTourCompleted,
    currentStep,
    tourSteps,
    completedActions,
    startTour,
    nextStep,
    skipTour,
    completeTour,
    completeAction,
    resetTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

export default TourContext;

