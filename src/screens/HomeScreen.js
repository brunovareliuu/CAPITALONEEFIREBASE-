import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  Animated,
  Easing,
  Image,
  PixelRatio,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { getCards, getExpenses, getCategories, getParticipants, getExpenseCategorizationsForCard, getUserProfile, getTarjetasDigitales, getAccountById, getUserAccounts } from '../services/firestoreService';
import EventBus from '../utils/EventBus';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../styles/colors';
import TourStepWelcome from '../components/TourStepWelcome';
import TourStepCompletion from '../components/TourStepCompletion';
import { getCardType, getCardColors, getCardTypeLabel, shouldShowTypeBadge } from '../utils/cardUtils';

const { width: screenWidth } = Dimensions.get('window');

// Función para escalar tamaños basado en el ancho de pantalla
const scale = (size) => {
  const guidelineBaseWidth = 375;
  return (screenWidth / guidelineBaseWidth) * size;
};

// Función para tamaños de fuente responsivos
const scaleFont = (size) => {
  const scaleFactor = PixelRatio.getFontScale();
  return scale(size) / scaleFactor;
};


const HomeScreen = ({ navigation }) => {
  const { user, dataRefreshTrigger } = useAuth();
  const { isTourActive, currentStep, tourSteps, completedActions, startTour, nextStep, skipTour, completeTour, isTourCompleted } = useTour();
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expenses, setExpenses] = useState({});
  const [categories, setCategories] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [expenseCategorizations, setExpenseCategorizations] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showCategoriesSubmenu, setShowCategoriesSubmenu] = useState(false);
  const [showPlansSubmenu, setShowPlansSubmenu] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [tarjetaDigital, setTarjetaDigital] = useState(null);
  const [tarjetaDigitalBalance, setTarjetaDigitalBalance] = useState(0);
  const [savingsCard, setSavingsCard] = useState(null);
  const [savingsCardBalance, setSavingsCardBalance] = useState(0);
  const [creditCard, setCreditCard] = useState(null);
  const [creditCardLimit, setCreditCardLimit] = useState(7000);
  const [recentActivities, setRecentActivities] = useState([]);
  const [showCvv, setShowCvv] = useState(false);
  const cardScrollRef = useRef(null);
  const [isPolling, setIsPolling] = useState(false);

  // Animation refs
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-50)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;
  const cardsScale = useRef(new Animated.Value(0.9)).current;
  const hamburgerScale = useRef(new Animated.Value(1)).current;
  const menuTranslateX = useRef(new Animated.Value(-screenWidth * 0.75)).current;

  // Entry animations
  useEffect(() => {
    const startAnimations = () => {
      // Header animation with smoother easing
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Cards animation with staggered delay and smoother spring
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(cardsOpacity, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(cardsScale, {
            toValue: 1,
            tension: 80,
            friction: 12,
            delay: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);
    };

    // Small delay to ensure component is mounted
    setTimeout(startAnimations, 50);
  }, []);

  // Load user profile
  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(doc => {
        if (doc.exists()) {
          setUserProfile(doc.data());
        }
      });
    }
  }, [user]);

  // Load digital cards from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = getTarjetasDigitales(user.uid, (tarjetas) => {
      // Find checking account (primary account)
      const checkingCard = tarjetas.find(card =>
        card.tipo?.toLowerCase().includes('checking') ||
        card.type?.toLowerCase().includes('checking')
      );

      // Find savings account
      const savingsAccount = tarjetas.find(card =>
        card.tipo?.toLowerCase().includes('savings') ||
        card.type?.toLowerCase().includes('savings')
      );

      // Set checking card as primary (tarjetaDigital)
      if (checkingCard) {
        setTarjetaDigital(checkingCard);
      } else if (tarjetas.length > 0) {
        // Fallback to first card if no checking found
        setTarjetaDigital(tarjetas[0]);
      } else {
        setTarjetaDigital(null);
        setTarjetaDigitalBalance(0);
      }

      // Set savings card separately
      if (savingsAccount) {
        setSavingsCard(savingsAccount);
      } else {
        setSavingsCard(null);
        setSavingsCardBalance(0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Load account balance from Firestore
  useEffect(() => {
    const loadBalance = async () => {
      if (tarjetaDigital?.accountId) {
        try {
          const accountDoc = await getAccountById(tarjetaDigital.accountId);
          if (accountDoc.exists()) {
            const accountData = accountDoc.data();
            setTarjetaDigitalBalance(accountData.balance || 0);
          } else {
            setTarjetaDigitalBalance(tarjetaDigital.saldo || 0);
          }
        } catch (error) {
          console.error('Error loading balance:', error);
          setTarjetaDigitalBalance(tarjetaDigital.saldo || 0);
        }
      } else {
        setTarjetaDigitalBalance(tarjetaDigital?.saldo || 0);
      }
    };

    if (tarjetaDigital) {
      loadBalance();
    }
  }, [tarjetaDigital]);

  // Load savings account balance from Firestore
  useEffect(() => {
    const loadSavingsBalance = async () => {
      if (savingsCard?.accountId) {
        try {
          const accountDoc = await getAccountById(savingsCard.accountId);
          if (accountDoc.exists()) {
            const accountData = accountDoc.data();
            setSavingsCardBalance(accountData.balance || 0);
          } else {
            setSavingsCardBalance(savingsCard?.saldo || 0);
          }
        } catch (error) {
          console.error('Error loading savings balance:', error);
          setSavingsCardBalance(savingsCard?.saldo || 0);
        }
      } else {
        setSavingsCardBalance(savingsCard?.saldo || 0);
      }
    };

    if (savingsCard) {
      loadSavingsBalance();
    }
  }, [savingsCard]);

  // Force refresh all balances when needed
  const forceRefreshBalances = useCallback(async () => {
    console.log('🔄 Force refreshing all balances...');

    // Refresh tarjetaDigital balance
    if (tarjetaDigital?.accountId) {
      try {
        const accountDoc = await getAccountById(tarjetaDigital.accountId);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          setTarjetaDigitalBalance(accountData.balance || 0);
        }
      } catch (error) {
        console.error('Error refreshing tarjetaDigital balance:', error);
      }
    }

    // Refresh savingsCard balance
    if (savingsCard?.accountId) {
      try {
        const accountDoc = await getAccountById(savingsCard.accountId);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          setSavingsCardBalance(accountData.balance || 0);
        }
      } catch (error) {
        console.error('Error refreshing savingsCard balance:', error);
      }
    }

    // Refresh creditCard balance
    if (creditCard?.id) {
      try {
        const userAccounts = await new Promise((resolve) => {
          const unsubscribe = getUserAccounts(user.uid, (accounts) => {
            unsubscribe();
            resolve(accounts);
          });
        });
        const updatedCreditCard = userAccounts.find(account =>
          account.id === creditCard.id && (account.accountType === 'credit' || account.type === 'Credit Card')
        );
        if (updatedCreditCard) {
          setCreditCard(updatedCreditCard);
        }
      } catch (error) {
        console.error('Error refreshing creditCard balance:', error);
      }
    }
  }, [tarjetaDigital, savingsCard, creditCard, user]);

  // Realtime updates: listen to balance events from transfers
  useEffect(() => {
    const handler = (data) => {
      if (!data) return;

      // Check tarjetaDigital balance updates
      if (tarjetaDigital?.accountId === data.accountId && typeof data.newBalance === 'number') {
        setTarjetaDigitalBalance(data.newBalance);
      }

      // Check savings account balance updates
      if (savingsCard?.accountId === data.accountId && typeof data.newBalance === 'number') {
        setSavingsCardBalance(data.newBalance);
      }

      // Check credit card balance updates
      if (creditCard?.id === data.accountId && typeof data.newBalance === 'number') {
        setCreditCard(prev => prev ? { ...prev, balance: data.newBalance } : null);
      }
    };
    EventBus.on('balance:updated', handler);
    return () => EventBus.off('balance:updated', handler);
  }, [tarjetaDigital, savingsCard, creditCard]);

  // Smart polling for a few seconds after an update
  useEffect(() => {
    if (!isPolling || !tarjetaDigital?.accountId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const accountDoc = await getAccountById(tarjetaDigital.accountId);
        if (accountDoc.exists() && !cancelled) {
          const accountData = accountDoc.data();
          setTarjetaDigitalBalance(accountData.balance || 0);
        }
      } catch (_e) {}
    }, 2000);
    const timeout = setTimeout(() => { setIsPolling(false); }, 10000);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
  }, [isPolling, tarjetaDigital]);

  // When Home gains focus, refresh all balances once
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const reload = async () => {

        // Refresh tarjetaDigital balance
        if (tarjetaDigital?.accountId) {
          try {
            const accountDoc = await getAccountById(tarjetaDigital.accountId);
            if (accountDoc.exists() && mounted) {
              const accountData = accountDoc.data();
              setTarjetaDigitalBalance(accountData.balance || 0);
            }
          } catch (_e) {}
        }

        // Refresh savingsCard balance
        if (savingsCard?.accountId) {
          try {
            const accountDoc = await getAccountById(savingsCard.accountId);
            if (accountDoc.exists() && mounted) {
              const accountData = accountDoc.data();
              setSavingsCardBalance(accountData.balance || 0);
            }
          } catch (_e) {}
        }

        // Refresh creditCard balance (from user accounts)
        if (creditCard?.id) {
          try {
            const userAccounts = await new Promise((resolve) => {
              const unsubscribe = getUserAccounts(user.uid, (accounts) => {
                unsubscribe();
                resolve(accounts);
              });
            });
            const updatedCreditCard = userAccounts.find(account =>
              account.id === creditCard.id && (account.accountType === 'credit' || account.type === 'Credit Card')
            );
            if (updatedCreditCard && mounted) {
              setCreditCard(updatedCreditCard);
            }
          } catch (_e) {}
        }
      };
      reload();
      return () => { mounted = false; };
    }, [tarjetaDigital, savingsCard, creditCard, user])
  );

  // Load recent activities (mock data)
  useEffect(() => {
    if (tarjetaDigital) {
      setRecentActivities([
        {
          id: '1',
          type: 'purchase',
          title: 'Starbucks Purchase',
          subtitle: 'Hace 2 horas',
          amount: -12.50,
          icon: 'shopping-cart',
          color: '#FFEBEE',
          iconColor: '#F44336'
        },
        {
          id: '2',
          type: 'deposit',
          title: 'Payroll Deposit',
          subtitle: 'Ayer',
          amount: 2500.00,
          icon: 'briefcase',
          color: '#E3F2FD',
          iconColor: '#1976D2'
        },
        {
          id: '3',
          type: 'purchase',
          title: 'Uber',
          subtitle: 'Hace 3 días',
          amount: -25.00,
          icon: 'car',
          color: '#F3E5F5',
          iconColor: '#7B1FA2'
        }
      ]);
    }
  }, [tarjetaDigital]);

  // Refresh data when dataRefreshTrigger changes (e.g., after a purchase)
  useEffect(() => {
    if (!user || !tarjetaDigital || dataRefreshTrigger === 0) return;

    const refreshBalanceAndActivities = async () => {
      // Refresh balance from Firestore
      if (tarjetaDigital?.accountId) {
        try {
          const accountDoc = await getAccountById(tarjetaDigital.accountId);
          if (accountDoc.exists()) {
            const accountData = accountDoc.data();
            setTarjetaDigitalBalance(accountData.balance || 0);
          }
        } catch (error) {
          console.error('Error refreshing balance:', error);
        }
      }

      // Keep same mock activities
      setRecentActivities([
        {
          id: '1',
          type: 'purchase',
          title: 'Starbucks Purchase',
          subtitle: 'Hace 2 horas',
          amount: -12.50,
          icon: 'shopping-cart',
          color: '#FFEBEE',
          iconColor: '#F44336'
        },
        {
          id: '2',
          type: 'deposit',
          title: 'Payroll Deposit',
          subtitle: 'Ayer',
          amount: 2500.00,
          icon: 'briefcase',
          color: '#E3F2FD',
          iconColor: '#1976D2'
        },
        {
          id: '3',
          type: 'purchase',
          title: 'Uber',
          subtitle: 'Hace 3 días',
          amount: -25.00,
          icon: 'car',
          color: '#F3E5F5',
          iconColor: '#7B1FA2'
        }
      ]);
    };

    refreshBalanceAndActivities();
  }, [dataRefreshTrigger, user, tarjetaDigital]);

  // Auto-start tour for new users
  useEffect(() => {
    if (user && cards.length === 0 && categories.length === 0 && !isTourCompleted && !isTourActive) {
      // Delay tour start to ensure UI is loaded
      const timer = setTimeout(() => {
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, cards.length, categories.length, isTourCompleted, isTourActive, startTour]);

  // Load cards from Firestore (physical cards)
  useEffect(() => {
    if (!user) return;

    const unsubscribe = getCards(user.uid, (userCards) => {
      setCards(userCards);
      if (userCards.length > 0 && currentCardIndex >= userCards.length) {
        setCurrentCardIndex(0);
      }
    });

    return () => unsubscribe();
  }, [user, dataRefreshTrigger]);

  // Load credit card account from user accounts
  useEffect(() => {
    if (!user) return;

    const unsubscribe = getUserAccounts(user.uid, (userAccounts) => {
      // Find credit card account
      const creditCardAccount = userAccounts.find(account =>
        account.accountType === 'credit' || account.type === 'Credit Card'
      );

      if (creditCardAccount) {
        setCreditCard(creditCardAccount);
        // Set credit limit from the account's initial balance
        setCreditCardLimit(creditCardAccount.initialBalance || creditCardAccount.balance || 7000);
      } else {
        setCreditCard(null);
        setCreditCardLimit(7000); // Default limit
      }
    });

    return () => unsubscribe();
  }, [user, dataRefreshTrigger]);

  // Load expenses from Firestore (for all user cards)
  useEffect(() => {
    if (!user || cards.length === 0) return;

    const unsubscribes = [];
    const expensesByCard = {};

    cards.forEach(card => {
      const unsubscribe = getExpenses(card.id, (cardExpenses) => {
        expensesByCard[card.id] = cardExpenses;
        setExpenses({ ...expensesByCard });

        // Also load categorizations for this card
        const categorizationsUnsubscribe = getExpenseCategorizationsForCard(card.id, (cardCategorizations) => {
          setExpenseCategorizations(prev => ({
            ...(prev || {}),
            [card.id]: cardCategorizations || {}
          }));
        });
        unsubscribes.push(categorizationsUnsubscribe);
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user, cards]);

  // Load user categories to map id -> name and icon
  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCategories(user.uid, (userCategories) => setCategories(userCategories));
    return () => unsubscribe();
  }, [user]);

  // Load participants by card for active count
  useEffect(() => {
    if (!user || cards.length === 0) return;
    const unsubscribes = [];
    const map = {};
    cards.forEach((card) => {
      if (card.isShared) {
        const unsub = getParticipants(card.id, (list) => {
          // list already includes the owner, so just use the length
          map[card.id] = list.length;
          setParticipantsMap({ ...map });
        });
        unsubscribes.push(unsub);
      }
    });
    return () => unsubscribes.forEach((u) => u());
  }, [user, cards]);


  // Reset currentCardIndex when cards change
  useEffect(() => {
    if (cards.length === 0) {
      setCurrentCardIndex(0);
    } else if (currentCardIndex >= cards.length) {
      setCurrentCardIndex(0);
    }
  }, [cards.length, currentCardIndex]);

  // Listener to detect when returning to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // We don't need to do anything here anymore because Firestore updates automatically
    });

    return unsubscribe;
  }, [navigation]);

  const handleCreateCard = () => {
    setShowCreateModal(true);
  };

  const createNewCard = () => {
    setShowCreateModal(false);
    navigation.navigate('CreateCard', { isShared: false });
  };

  const joinSharedCard = () => {
    setShowCreateModal(false);
    navigation.navigate('JoinCard');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  // Special format for card balance: with currency symbol, and negative sign before the symbol
  const formatCardBalance = (amount) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const findCategory = (categoryId) => categories.find((c) => c.id === categoryId);

  // Check if an expense is pending (considering individual categorizations)
  const isExpensePending = (card, expense) => {
    const cardCategorizations = (expenseCategorizations || {})[card.id] || {};
    const expenseCats = cardCategorizations[expense.id] || {};
    const userCategorization = (expenseCats || {})[user.uid] || {};

    // If the user has a specific categorization for this expense, it's not pending for them.
    if (userCategorization && userCategorization.category) {
      return false;
    }

    // For shared cards/expenses where the user hasn't categorized, it is pending.
    if (card?.isShared || expense.sharedExpense || expense.participants) {
      return true;
    }
    
    // For non-shared cards, fall back to the status field.
    return expense.status === 'pending';
  };

  const formatDate = (dateString) => {
    // Parse YYYY-MM-DD locally to avoid timezone shifts
    const parts = (dateString || '').split('-');
    const date = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0, 0)
      : new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      });
    }
  };

  const getCardBalance = (cardId) => {
    const card = cards.find(c => c.id === cardId);
    const cardExpenses = expenses[cardId] || [];
    const totalTransactions = cardExpenses.reduce((total, expense) => total + expense.amount, 0);
    const initialBalance = card?.initialBalance || 0;
    return initialBalance + totalTransactions;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      console.log('🔄 Starting refresh of all user data...');

      // Refresh digital card balance
      if (tarjetaDigital?.accountId) {
        // Refresh balance from Firestore
        const accountDoc = await getAccountById(tarjetaDigital.accountId);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          const balance = accountData.balance || 0;
          setTarjetaDigitalBalance(balance);
          console.log('✅ Refreshed tarjetaDigital balance from Firestore:', balance);
        }
      }

      // Refresh savings account balance
      if (savingsCard?.accountId) {
        const accountDoc = await getAccountById(savingsCard.accountId);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          const balance = accountData.balance || 0;
          setSavingsCardBalance(balance);
          console.log('✅ Refreshed savingsCard balance from Firestore:', balance);
        }
      }

      // Refresh creditCard balance (from user accounts)
      if (creditCard?.id) {
        const userAccounts = await new Promise((resolve) => {
          const unsubscribe = getUserAccounts(user.uid, (accounts) => {
            unsubscribe();
            resolve(accounts);
          });
        });
        const updatedCreditCard = userAccounts.find(account =>
          account.id === creditCard.id && (account.accountType === 'credit' || account.type === 'Credit Card')
        );
        if (updatedCreditCard) {
          setCreditCard(updatedCreditCard);
          console.log('✅ Refreshed creditCard balance:', updatedCreditCard.balance || 0);
        }
      }

      // Refresh balances for all regular cards (using Firebase)
      const cardsWithAccountIds = cards.filter(card => card.accountId);
      if (cardsWithAccountIds.length > 0) {
        // Refresh balances for regular cards using Firebase
        for (const card of cardsWithAccountIds) {
          try {
            const accountDoc = await getAccountById(card.accountId);
            if (accountDoc.exists()) {
              const accountData = accountDoc.data();
              const balance = accountData.balance || 0;
              console.log(`✅ Refreshed ${card.name} balance: ${balance}`);
            }
          } catch (error) {
            console.error(`❌ Error refreshing ${card.name} balance:`, error);
          }
        }
        console.log('✅ Refreshed regular cards balances');
      }

      // TODO: Refresh recent activities from Firebase transactions
      // For now, clear activities
      setRecentActivities([]);

      console.log('✅ All data refresh completed');

    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    } finally {
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
    }
  }, [tarjetaDigital, savingsCard, creditCard, cards, user]);

  const onCardScroll = useCallback((event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    if (index >= 0 && index < cards.length && index !== currentCardIndex) {
      setCurrentCardIndex(index);
    }
  }, [cards.length, currentCardIndex]);

  const openHamburgerMenu = () => {
    // Animate hamburger button press with smoother easing
    Animated.sequence([
      Animated.timing(hamburgerScale, {
        toValue: 0.92,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(hamburgerScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    setShowHamburgerMenu(true);
    // Animate menu slide in from left with smooth easing
    Animated.timing(menuTranslateX, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Don't auto-open any submenu
  };

  const closeHamburgerMenu = () => {
    // Animate menu slide out to left with smooth easing
    Animated.timing(menuTranslateX, {
      toValue: -screenWidth * 0.75,
      duration: 300,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowHamburgerMenu(false);
      // Reset submenu states when menu closes
      setShowCategoriesSubmenu(false);
      setShowPlansSubmenu(false);
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== null && newIndex >= 0 && newIndex < cards.length) {
        setCurrentCardIndex(newIndex);
      }
    }
  }).current;


  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const getCardIcon = (type) => {
    switch(type) {
      case 'cash': return 'money-bill-wave';
      case 'credit': return 'credit-card';
      case 'debit': return 'credit-card';
      case 'savings': return 'piggy-bank';
      default: return 'credit-card';
    }
  };

  const getCardTypeLabel = (type) => {
    switch(type) {
      case 'cash': return 'CASH';
      case 'credit': return 'CREDIT';
      case 'debit': return 'DEBIT';
      case 'savings': return 'SAVINGS';
      default: return 'CARD';
    }
  };

  // Capital One Clean UI
  const BalanceCard = () => {
    if (!tarjetaDigital) return null;

    const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

    return (
      <ScrollView
        style={styles.cleanMainContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00487A"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section - Capital One Blue */}
        <View style={styles.cleanTopSection}>
          <View style={styles.cleanTopContent}>
        <TouchableOpacity
              style={styles.cleanIconButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Icon name="user-circle" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.cleanHeaderIcons}>
              <TouchableOpacity 
                style={styles.cleanIconButton}
                onPress={() => {}}
                activeOpacity={0.7}
              >
                <Icon name="eye" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cleanIconButton}
                onPress={() => {}}
                activeOpacity={0.7}
              >
                <Icon name="bell" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cleanIconButton}
                onPress={() => {}}
                activeOpacity={0.7}
              >
                <Icon name="cog" size={22} color="#FFFFFF" />
              </TouchableOpacity>
                  </View>
              </View>
            </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 1: Capital One Account + Quick Actions */}
        <View style={styles.cleanSection}>
          <TouchableOpacity
            onPress={() => navigation.navigate('TarjetaDigitalDetails', { tarjetaDigital })}
            activeOpacity={0.8}
          >
            <View style={styles.cleanTitleRow}>
              <Text style={styles.cleanSectionTitle}>Capital One Account</Text>
              <Icon name="chevron-right" size={18} color="#666" />
            </View>
            <Text style={styles.cleanBalance}>
              ${tarjetaDigitalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
              </Text>
          </TouchableOpacity>

          {/* Quick Actions Buttons (7 total) - Horizontal Scroll */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.cleanQuickActionsStrip}
            contentContainerStyle={styles.cleanQuickActionsScroll}
          >
            {/* 1. Receive / Deposit */}
            <TouchableOpacity 
              style={styles.cleanActionButtonFirst}
              onPress={() => navigation.navigate('ReceiveMoney', { tarjetaDigital })}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="download" size={20} color="#00487A" />
            </View>
              <Text style={styles.cleanActionText}>Receive</Text>
        </TouchableOpacity>

            {/* 2. Transfer */}
            <TouchableOpacity 
              style={styles.cleanActionButton}
              onPress={() => navigation.navigate('TransferContactSearch', { tarjetaDigital })}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="paper-plane" size={20} color="#00487A" />
              </View>
              <Text style={styles.cleanActionText}>Transfer</Text>
            </TouchableOpacity>

            {/* 3. Bills */}
            <TouchableOpacity 
              style={styles.cleanActionButton}
              onPress={() => navigation.navigate('Bills')}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="file-invoice-dollar" size={20} color="#00487A" />
              </View>
              <Text style={styles.cleanActionText}>Bills</Text>
            </TouchableOpacity>

            {/* 4. Simulate Loan */}
            <TouchableOpacity 
              style={styles.cleanActionButton}
              onPress={() => navigation.navigate('BudgetManagement')}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="hand-holding-usd" size={18} color="#00487A" />
              </View>
              <Text style={styles.cleanActionText}>Simulate</Text>
            </TouchableOpacity>

            {/* 5. History */}
            <TouchableOpacity 
              style={styles.cleanActionButton}
              onPress={() => navigation.navigate('TransferHistory')}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="history" size={20} color="#00487A" />
              </View>
              <Text style={styles.cleanActionText}>History</Text>
            </TouchableOpacity>

            {/* 6. Goals */}
            <TouchableOpacity 
              style={styles.cleanActionButton}
              onPress={() => navigation.navigate('Plans')}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="bullseye" size={20} color="#00487A" />
          </View>
              <Text style={styles.cleanActionText}>Goals</Text>
            </TouchableOpacity>

            {/* 7. More */}
            <TouchableOpacity 
              style={styles.cleanActionButton}
              onPress={() => {}}
              activeOpacity={0.8}
            >
              <View style={styles.cleanActionCircle}>
                <Icon name="ellipsis-h" size={20} color="#00487A" />
              </View>
              <Text style={styles.cleanActionText}>More</Text>
            </TouchableOpacity>
          </ScrollView>
          </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 2: Credit Card */}
        <View style={styles.cleanSection}>
          <TouchableOpacity
            onPress={() => {
              if (creditCard) {
                // Navigate to credit card account details
                // Convert account format to match TarjetaDigitalDetails expectations
                // Generate a formatted credit card number for display
                const generateCardNumber = () => {
                  const num1 = Math.floor(1000 + Math.random() * 9000);
                  const num2 = Math.floor(1000 + Math.random() * 9000);
                  const num3 = Math.floor(1000 + Math.random() * 9000);
                  const num4 = Math.floor(1000 + Math.random() * 9000);
                  return `${num1} ${num2} ${num3} ${num4}`;
                };

                // Generate a real CVV for display
                const generateCVV = () => {
                  return Math.floor(100 + Math.random() * 900).toString();
                };

                const creditCardForDetails = {
                  ...creditCard,
                  numeroTarjeta: generateCardNumber(),
                  fechaExpiracion: '12/29', // Default expiration
                  cvv: generateCVV(), // Generate real CVV instead of ***
                  nombreTitular: user?.displayName || user?.email?.split('@')[0] || 'Card Holder',
                  tipo: 'Credit Card',
                  tipoTexto: 'CREDIT',
                  saldo: creditCard.balance || 0,
                  activa: true,
                  nickname: creditCard.nickname || 'Credit Card',
                  userId: user.uid,
                  accountId: creditCard.id, // Firebase account ID
                };
                navigation.navigate('TarjetaDigitalDetails', { tarjetaDigital: creditCardForDetails });
              } else {
                // Create new credit card
                navigation.navigate('AccountQuiz', {
                  skipTypeSelection: true,
                  accountType: 'Credit Card',
                  prefillNickname: true
                });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.cleanTitleRow}>
              <Text style={styles.cleanSectionTitle}>Credit Card</Text>
              <Icon name="chevron-right" size={18} color="#666" />
            </View>
            <View style={styles.cleanCreditInfo}>
              <Text style={styles.cleanCreditLabel}>
                Available Credit
              </Text>
              <Text style={styles.cleanCreditAmount}>
                ${creditCard ? formatCurrency(creditCard.balance || 0) : '0.00'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 2.5: Loan Button - Only show if credit card exists */}
        {creditCard && (
          <View style={styles.cleanSection}>
            <TouchableOpacity
              style={styles.cleanRectButton}
              onPress={() => {
                navigation.navigate('Loan');
              }}
              activeOpacity={0.8}
            >
              <Icon name="hand-holding-usd" size={20} color="#00487A" style={{ marginRight: 10 }} />
              <Text style={styles.cleanRectButtonText}>LOAN</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Section 3: Savings Account */}
        <View style={styles.cleanSection}>
          <TouchableOpacity
            onPress={() => {
              if (savingsCard) {
                // Navigate to savings card details
                navigation.navigate('TarjetaDigitalDetails', { tarjetaDigital: savingsCard });
              } else {
                // Create new savings account
                navigation.navigate('AccountQuiz', {
                  skipTypeSelection: true,
                  accountType: 'Savings',
                  prefillNickname: true
                });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.cleanTitleRow}>
              <Text style={styles.cleanSectionTitle}>Savings Account</Text>
              <Icon name="chevron-right" size={18} color="#666" />
            </View>
            <View style={styles.cleanCreditInfo}>
              <Text style={styles.cleanCreditLabel}>Current Balance</Text>
              <Text style={styles.cleanCreditAmount}>
                ${savingsCard ? savingsCardBalance.toFixed(2) : '0.00'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 3: MSI and My Cards Buttons */}
        {/* Transfer to Savings Button */}
        <View style={styles.cleanSection}>
          <TouchableOpacity
            style={styles.cleanRectButton}
            onPress={() => navigation.navigate('TransferSavings', {
              fromAccount: tarjetaDigital,
              toAccount: savingsCard,
              accountType: 'savings_deposit'
            })}
            activeOpacity={0.8}
          >
            <Icon name="arrow-up" size={20} color="#00487A" style={{ marginRight: 10 }} />
            <Text style={styles.cleanRectButtonText}>Transfer to Savings</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 5: MSI and My Cards Buttons */}
        <View style={styles.cleanSection}>
          <TouchableOpacity
            style={styles.cleanRectButton}
            onPress={() => {}}
            activeOpacity={0.8}
          >
            <Icon name="calendar-check" size={20} color="#00487A" style={{ marginRight: 10 }} />
            <Text style={styles.cleanRectButtonText}>Interest-Free Installments with Capital One</Text>
            </TouchableOpacity>

          <TouchableOpacity
            style={styles.cleanRectButton}
            onPress={() => navigation.navigate('AccountQuiz', {
              skipTypeSelection: true,
              accountType: 'Checking',
              prefillNickname: true
            })}
            activeOpacity={0.8}
          >
            <Icon name="wallet" size={20} color="#00487A" style={{ marginRight: 10 }} />
            <Text style={styles.cleanRectButtonText}>Create Debit Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cleanRectButton}
            onPress={() => navigation.navigate('CapitalOne')}
            activeOpacity={0.8}
          >
            <Icon name="credit-card" size={20} color="#00487A" style={{ marginRight: 10 }} />
            <Text style={styles.cleanRectButtonText}>My Cards</Text>
          </TouchableOpacity>
              </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 4: Personal Loan */}
        <View style={styles.cleanSection}>
          <View style={styles.cleanTitleRow}>
            <Text style={styles.cleanSectionTitle}>Personal Loan</Text>
            <Icon name="chevron-right" size={18} color="#666" />
              </View>
          <Text style={styles.cleanSubtitle}>
            Simulate and discover in seconds the offer we have for you.
          </Text>
          <TouchableOpacity 
            style={styles.cleanSimulateButton}
            activeOpacity={0.8}
          >
            <Text style={styles.cleanSimulateButtonText}>Simulate loan</Text>
            </TouchableOpacity>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 5: Never Miss a Payment */}
        <View style={styles.cleanSection}>
          <View style={styles.cleanTitleRow}>
            <Text style={styles.cleanSectionTitle}>Never miss a payment!</Text>
            <Icon name="chevron-right" size={18} color="#666" />
              </View>
          <Text style={styles.cleanSubtitle}>
            Tell us which services you pay and we'll help you organize.
          </Text>
              </View>

        {/* Horizontal Divider */}
        <View style={styles.fullWidthDivider} />

        {/* Section 6: Discover More */}
        <View style={styles.cleanSection}>
          <Text style={styles.cleanDiscoverTitle}>Discover More</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cleanDiscoverScroll}
          >
            <TouchableOpacity 
              style={styles.cleanDiscoverCard}
              activeOpacity={0.9}
            >
              <View style={styles.cleanDiscoverImage}>
                <Icon name="users" size={40} color="#00487A" />
              </View>
              <Text style={styles.cleanDiscoverCardTitle}>
                Share the Capital One experience
              </Text>
              <Text style={styles.cleanDiscoverCardText}>
                Invite someone to open their Capital One account today.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cleanDiscoverCard}
              activeOpacity={0.9}
            >
              <View style={styles.cleanDiscoverImage}>
                <Icon name="shopping-bag" size={40} color="#00487A" />
          </View>
              <Text style={styles.cleanDiscoverCardTitle}>
                Interest-Free Shopping
              </Text>
              <Text style={styles.cleanDiscoverCardText}>
                Discover your favorite brands with zero interest installments.
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyCard}>
        <Icon name="credit-card" size={48} color="#666" />
        <Text style={styles.emptyTitle}>Welcome to Capital One</Text>
        <Text style={styles.emptySubtitle}>
          Create your digital debit card to start managing your finances
        </Text>

        <View style={styles.emptyButtons}>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: '#FF4444' }]}
            onPress={() => {
              // Navigate to create digital card
              setShowCreateModal(false);
              // This will be handled by the tour or navigation flow
            }}
          >
            <Icon name="credit-card" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.createButtonText}>Create Digital Card</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.joinButton} onPress={joinSharedCard}>
            <Icon name="users" size={16} color="#007AFF" style={styles.buttonIcon} />
            <Text style={styles.joinButtonText}>Join Shared Card</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCard = useCallback(({ item: card, index }) => {
    const cardExpenses = expenses[card.id] || [];

    // Define card style based on type
    const cardStyle = [
      styles.cardSlide,
      { backgroundColor: card.color },
      !card.description && { height: 140 },
    ];

    return (
      <View style={styles.cardPageContainer}>
        {/* Card */}
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => navigation.navigate('EditCard', { cardId: card.id })}
          activeOpacity={0.9}
        >
          <View style={cardStyle}>
            <View style={styles.cardHeader}>
              <View style={styles.cardInfo}>
                <Icon
                  name={getCardIcon(card.type)}
                  size={24}
                  color={'#fff'}
                />
                <View style={styles.cardTitleContainer}>
                  <Text style={[styles.cardTitle, { color: '#fff' }]}>{card.name}</Text>
                  <Text style={[styles.cardTypeLabel, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                    {getCardTypeLabel(card.type)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {card.isShared ? (
                  <>
                    <Icon name="users" size={12} color={'rgba(255,255,255,0.8)'} />
                    <Text style={[styles.shareCode, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                      {participantsMap[card.id] || 1}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.shareCode, { color: 'rgba(255, 255, 255, 0.8)' }]}>You</Text>
                )}
              </View>
            </View>

            <View style={styles.cardBalance}>
              {card.type === 'savings' ? (
                <Text style={[styles.balanceAmount, { color: '#fff' }]}>
                  <Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={28} color={'#fff'} /> {formatCurrency(getCardBalance(card.id))}
                  <Text style={{ fontSize: 18, fontWeight: 'normal' }}> / <Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={18} color={'#fff'} /> {formatCurrency(card.goalAmount || 0)}</Text>
                </Text>
              ) : card.type === 'credit' ? (
                <Text style={[styles.balanceAmount, { color: '#fff' }]}>
                  <Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={28} color={'#fff'} /> {formatCurrency(Math.abs(getCardBalance(card.id)))}
                  <Text style={{ fontSize: 18, fontWeight: 'normal' }}> / <Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={18} color={'#fff'} /> {formatCurrency(card.creditLimit || 0)}</Text>
                </Text>
              ) : (
                <Text style={[styles.balanceAmount, { color: '#fff' }]}>
                  <Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={28} color={'#fff'} /> {formatCardBalance(getCardBalance(card.id))}
                </Text>
              )}
            </View>

            {card.description && (
              <Text style={[styles.cardDescription, { color: 'rgba(255, 255, 255, 0.9)' }]}>{card.description}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Transactions */}
        <View style={styles.expensesContainer}>
          <Text style={styles.expensesTitle}>Recent Transactions</Text>

          {cardExpenses.length === 0 ? (
            <View style={styles.noExpenses}>
              <Icon name="receipt" size={32} color="#ccc" />
              <Text style={styles.noExpensesText}>
                No transactions in this card
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {cardExpenses.map((expense) => {
                  // Check if this card is shared
                  const isCardShared = card?.isShared || false;

                  let cat;
                  // Unified logic: Always check for the user-specific categorization first.
                  const cardCategorizations = (expenseCategorizations || {})[card.id] || {};
                  const expenseCats = cardCategorizations[expense.id] || {};
                  const userCategorization = (expenseCats || {})[user.uid] || {};

                  if (userCategorization && userCategorization.category) {
                    cat = findCategory(userCategorization.category);
                  } else {
                    // Fallback for legacy data that might have the category on the expense doc itself.
                    cat = findCategory(expense.category);
                  }

                  // If category is still not found, check if it's a recreated expense
                  // and try to get the category from the original recurring expense.
                  if (!cat && expense.originalRecurrenceId) {
                    const originalExpenseCats = cardCategorizations[expense.originalRecurrenceId] || {};
                    const originalUserCategorization = (originalExpenseCats || {})[user.uid] || {};
                    if (originalUserCategorization && originalUserCategorization.category) {
                      cat = findCategory(originalUserCategorization.category);
                    }
                  }

                  const isPending = isExpensePending(card, expense);

                  return (
                  <TouchableOpacity key={expense.id} style={[styles.expenseItem, isPending && styles.expenseItemPending]} activeOpacity={0.8} onPress={() => {
                    navigation.navigate('EditExpense', { cardId: card.id, expense });
                  }}>
                    <View style={styles.expenseLeft}>
                      {isPending && <Text style={styles.pendingText}>PENDING</Text>}
                      <Text style={styles.expenseDescription}>{expense.description}</Text>
                      {(() => {
                        if (expense.category === 'Credit Card Payment') {
                          let text = 'Card Payment';
                          if (expense.type === 'expense') { // Debit card
                            const creditCardName = expense.description.replace('Card payment: ', '');
                            text = `Payment for ${creditCardName}`;
                          } else { // Credit card
                            const fromCardName = expense.description.replace('Card payment from: ', '');
                            text = `Payment from ${fromCardName}`;
                          }
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Icon name="exchange-alt" size={12} color="#666" />
                              <Text style={styles.expenseMeta}>{text}</Text>
                            </View>
                          );
                        }
                        if (!cat) {
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Icon name={'question-circle'} size={12} color="#666" />
                              <Text style={styles.expenseMeta}>
                                Pending categorization
                              </Text>
                            </View>
                          );
                        }
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {cat ? <Icon name={cat.icon || 'tag'} size={12} color="#666" /> : null}
                            <Text style={styles.expenseMeta}>
                              {cat ? cat.name : 'Category'}
                            </Text>
                          </View>
                        );
                      })()}
                      <Text style={styles.expenseMeta}>Frequency: {expense.recurrence || 'one-time'}</Text>
                      <Text style={styles.expenseDate}>{formatDate(expense.date)}</Text>
                    </View>
                    <Text style={[
                      styles.expenseAmount,
                      expense.amount < 0 ? styles.expenseNegative : styles.expensePositive
                    ]}>
                      {expense.amount < 0 ? '-' : '+'}<Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={14} />{formatCurrency(expense.amount)}
                    </Text>
                  </TouchableOpacity>
                )}
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  }, [expenses, navigation, categories, participantsMap, userProfile, expenseCategorizations]);

  const CardSliderWithTransactions = () => (
    <Animated.View
      style={[
        styles.mainContainer,
        {
          opacity: cardsOpacity,
          transform: [{ scale: cardsScale }],
        }
      ]}
    >
      <FlatList
        ref={cardScrollRef}
        data={cards}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={false}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        getItemLayout={(data, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        removeClippedSubviews={false}
        initialScrollIndex={0}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      />
    </Animated.View>
  );

  // Check if user has no cards at all (neither regular cards nor digital card)
  if (cards.length === 0 && !tarjetaDigital) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <Animated.View
              style={[
                styles.hamburgerButton,
                {
                  transform: [{ scale: hamburgerScale }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.hamburgerButtonTouchable}
                onPress={openHamburgerMenu}
                activeOpacity={0.8}
              >
                <Icon name="bars" size={20} color={'#007AFF'} />
              </TouchableOpacity>
            </Animated.View>
            <View>
              <Text style={styles.headerGreeting}>
                Welcome back, <Text style={styles.headerUserName}>{user?.displayName || user?.email?.split('@')[0] || 'User'}</Text>
              </Text>
            </View>
          </View>
        </Animated.View>

        <EmptyState />

        <Modal
          animationType="slide"
          transparent={true}
          visible={showCreateModal}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowCreateModal(false)}
          >
            <View style={styles.modalContent}>
              <Pressable onPress={null}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Card</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setShowCreateModal(false)}
                  >
                    <Icon name="times" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>
                  What type of card do you want to create?
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalPrimaryButton}
                    onPress={createNewCard}
                  >
                    <Icon name="plus" size={18} color="#fff" />
                    <Text style={styles.modalPrimaryButtonText}>
                      Create from scratch
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSecondaryButton}
                    onPress={joinSharedCard}
                  >
                    <Icon name="users" size={18} color="#007AFF" />
                    <Text style={styles.modalSecondaryButtonText}>
                      Join with code
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>


        {/* Hamburger Menu Modal */}
        <Modal
          animationType="none"
          transparent={true}
          visible={showHamburgerMenu}
          onRequestClose={closeHamburgerMenu}
        >
          <View style={styles.menuModalBackdrop}>
            <TouchableOpacity
              style={styles.menuModalBackdropTouchable}
              onPress={closeHamburgerMenu}
              activeOpacity={1}
            />
            <Animated.View
              style={[
                styles.menuModalContainer,
                {
                  transform: [{ translateX: menuTranslateX }]
                }
              ]}
            >
            {/* Blue header with logo and name */}
            <View style={styles.menuModalHeader}>
              <View style={styles.menuHeaderContent}>
                <View style={styles.menuLogo}>
                  <Icon name="user-circle" size={50} color="#fff" />
                </View>
                <View style={styles.menuUserInfo}>
                  <Text style={styles.menuUserName}>
                    {user?.displayName || user?.email?.split('@')[0] || 'User'}
                  </Text>
                  <Text style={styles.menuUserEmail}>{user?.email}</Text>
                </View>
              </View>
            </View>

            {/* Menu Items */}
            <ScrollView style={styles.menuModalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.menuItems}>
              {/* Profile */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('Profile');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#007AFF' }]}>
                  <Icon name="user" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Profile</Text>
              </TouchableOpacity>

              {/* General */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('General');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#34C759' }]}>
                  <Icon name="chart-bar" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>General</Text>
              </TouchableOpacity>

              {/* Bills */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('Bills');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FF9500' }]}>
                  <Icon name="receipt" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Bills</Text>
              </TouchableOpacity>

              {/* Budgets */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('BudgetManagement');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#AF52DE' }]}>
                  <Icon name="chart-pie" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Budgets</Text>
              </TouchableOpacity>

              {/* Pending Transactions */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('PendingTransactions');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#F59E0B' }]}>
                  <Icon name="clipboard-list" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Pending Transactions</Text>
              </TouchableOpacity>

              {/* Categories Section */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowCategoriesSubmenu(!showCategoriesSubmenu);
                  // Close other submenus when opening categories
                  if (!showCategoriesSubmenu) {
                    setShowPlansSubmenu(false);
                  }
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FF9500' }]}>
                  <Icon name="tag" size={20} color="#fff" />
                </View>
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuItemText}>Category</Text>
                  <Icon
                    name={showCategoriesSubmenu ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* Categories Submenu */}
              {showCategoriesSubmenu && (
                <>
                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowCategoriesSubmenu(false);
                      navigation.navigate('CreateCategory');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#FF9500' }]}>
                      <Icon name="plus" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Create Category</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowCategoriesSubmenu(false);
                      navigation.navigate('EditCategory');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#34C759' }]}>
                      <Icon name="edit" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Edit Categories</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Plans Section */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowPlansSubmenu(!showPlansSubmenu)}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FF2D55' }]}>
                  <Icon name="bullseye" size={20} color="#fff" />
                </View>
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuItemText}>Plans</Text>
                  <Icon
                    name={showPlansSubmenu ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* Plans Submenu */}
              {showPlansSubmenu && (
                <>
                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('CreatePlan');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#FF9500' }]}>
                      <Icon name="piggy-bank" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Create Savings Plan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('CreateGestionPlan');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#AF52DE' }]}>
                      <Icon name="tasks" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Create Gestion Plan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('Plans');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#34C759' }]}>
                      <Icon name="list" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>View All Plans</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('JoinPlan');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#007AFF' }]}>
                      <Icon name="user-plus" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Join Plan</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Dark Mode Toggle */}
              <View style={styles.menuItem}>
                <View style={[styles.menuItemIcon, { backgroundColor: '#5856D6' }]}>
                  <Icon name="moon" size={20} color="#fff" />
                </View>
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuItemText}>Dark Mode</Text>
                  <TouchableOpacity style={styles.darkModeToggle}>
                    <View style={styles.toggleTrack}>
                      <View style={styles.toggleThumbOff} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
          </Animated.View>
          </View>
        </Modal>

        {/* Tour Overlays */}
        {isTourActive && currentStep === 0 && (
          <TourStepWelcome
            visible={true}
            onNext={() => {
              nextStep();
              navigation.navigate('CreateCard', { isShared: false });
            }}
            onSkip={skipTour}
          />
        )}

        {isTourActive && currentStep === 4 && (
          <TourStepCompletion
            visible={true}
            onNext={completeTour}
            onSkip={null}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* Show Digital Card if exists, otherwise show regular cards */}
      {tarjetaDigital ? (
        <BalanceCard />
      ) : (
        <CardSliderWithTransactions />
      )}

      {/* Floating Action Button - Only show when user has regular cards (not digital card) */}
      {!tarjetaDigital && cards.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.fab}
          onPress={handleCreateCard}
        >
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateModal(false)}
        >
          <View style={styles.modalContent}>
            <Pressable onPress={null}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Card</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Icon name="times" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                What type of card do you want to create?
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={createNewCard}
                >
                  <Icon name="plus" size={18} color="#fff" />
                  <Text style={styles.modalPrimaryButtonText}>
                    Create from scratch
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={joinSharedCard}
                >
                  <Icon name="users" size={18} color="#007AFF" />
                  <Text style={styles.modalSecondaryButtonText}>
                    Join with code
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Hamburger Menu Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={showHamburgerMenu}
        onRequestClose={closeHamburgerMenu}
      >
        <View style={styles.menuModalBackdrop}>
          <TouchableOpacity
            style={styles.menuModalBackdropTouchable}
            onPress={closeHamburgerMenu}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              styles.menuModalContainer,
              {
                transform: [{ translateX: menuTranslateX }]
              }
            ]}
          >
          {/* Blue header with logo and name */}
          <View style={styles.menuModalHeader}>
            <View style={styles.menuHeaderContent}>
              <View style={styles.menuLogo}>
                <Icon name="user-circle" size={50} color="#fff" />
              </View>
              <View style={styles.menuUserInfo}>
                <Text style={styles.menuUserName}>
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text style={styles.menuUserEmail}>{user?.email}</Text>
              </View>
            </View>
          </View>

          {/* Menu Items */}
          <ScrollView style={styles.menuModalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.menuItems}>
              {/* Profile */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('Profile');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#007AFF' }]}>
                  <Icon name="user" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Profile</Text>
              </TouchableOpacity>

              {/* General */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('General');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#34C759' }]}>
                  <Icon name="chart-bar" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>General</Text>
              </TouchableOpacity>

              {/* Bills */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('Bills');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FF9500' }]}>
                  <Icon name="receipt" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Bills</Text>
              </TouchableOpacity>

              {/* Budgets */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('BudgetManagement');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#AF52DE' }]}>
                  <Icon name="chart-pie" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Budgets</Text>
              </TouchableOpacity>

              {/* Pending Transactions */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('PendingTransactions');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#F59E0B' }]}>
                  <Icon name="clipboard-list" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Pending Transactions</Text>
              </TouchableOpacity>

              {/* Recurring Transactions */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeHamburgerMenu();
                  navigation.navigate('FrequencyTransactionsScreen');
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#17A2B8' }]}>
                  <Icon name="sync-alt" size={20} color="#fff" />
                </View>
                <Text style={styles.menuItemText}>Frequent Transactions</Text>
              </TouchableOpacity>

              {/* Categories Section */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowCategoriesSubmenu(!showCategoriesSubmenu);
                  // Close other submenus when opening categories
                  if (!showCategoriesSubmenu) {
                    setShowPlansSubmenu(false);
                  }
                }}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FF9500' }]}>
                  <Icon name="tag" size={20} color="#fff" />
                </View>
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuItemText}>Category</Text>
                  <Icon
                    name={showCategoriesSubmenu ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* Categories Submenu */}
              {showCategoriesSubmenu && (
                <>
                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowCategoriesSubmenu(false);
                      navigation.navigate('CreateCategory');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#FF9500' }]}>
                      <Icon name="plus" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Create Category</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowCategoriesSubmenu(false);
                      navigation.navigate('EditCategory');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#34C759' }]}>
                      <Icon name="edit" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Edit Categories</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Plans Section */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowPlansSubmenu(!showPlansSubmenu)}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FF2D55' }]}>
                  <Icon name="bullseye" size={20} color="#fff" />
                </View>
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuItemText}>Plans</Text>
                  <Icon
                    name={showPlansSubmenu ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* Plans Submenu */}
              {showPlansSubmenu && (
                <>
                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('CreatePlan');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#FF9500' }]}>
                      <Icon name="piggy-bank" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Create Savings Plan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('CreateGestionPlan');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#AF52DE' }]}>
                      <Icon name="tasks" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Create Gestion Plan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('Plans');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#34C759' }]}>
                      <Icon name="list" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>View All Plans</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuSubItem]}
                    onPress={() => {
                      closeHamburgerMenu();
                      setShowPlansSubmenu(false);
                      navigation.navigate('JoinPlan');
                    }}
                  >
                    <View style={[styles.menuSubItemIcon, { backgroundColor: '#007AFF' }]}>
                      <Icon name="user-plus" size={16} color="#fff" />
                    </View>
                    <Text style={styles.menuSubItemText}>Join Plan</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Dark Mode Toggle */}
              <View style={styles.menuItem}>
                <View style={[styles.menuItemIcon, { backgroundColor: '#5856D6' }]}>
                  <Icon name="moon" size={20} color="#fff" />
                </View>
                <View style={styles.menuItemRight}>
                  <Text style={styles.menuItemText}>Dark Mode</Text>
                  <TouchableOpacity style={styles.darkModeToggle}>
                    <View style={styles.toggleTrack}>
                      <View style={styles.toggleThumbOff} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
        </View>
      </Modal>


    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00487A',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Top Header with Profile & Icons
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#00487A',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
  },
  userNameText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  hamburgerButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerGreeting: {
    fontSize: PixelRatio.getFontScale() > 1 ? 18 : 20,
    color: '#64748b',
    fontWeight: '400',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 22 : 24,
  },
  headerUserName: {
    fontSize: PixelRatio.getFontScale() > 1 ? 18 : 20,
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: 0.5,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 22 : 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 0,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  emptyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: PixelRatio.getFontScale() > 1 ? 16 : 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
    textAlign: 'center',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 20 : 22,
  },
  emptySubtitle: {
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: PixelRatio.getFontScale() > 1 ? 18 : 20,
    allowFontScaling: false,
  },
  emptyButtons: {
    width: '100%',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '600',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  joinButtonText: {
    color: '#007AFF',
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '600',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },
  emptyExpensesArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },

  // Main Container
  mainContainer: {
    flex: 1,
  },
  cardPageContainer: {
    width: screenWidth,
    flex: 1,
    paddingTop: 15,
  },
  cardContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
    cardSlide: {
    borderRadius: 20,
    padding: 25,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  addCardSlide: {
    borderRadius: 20,
    padding: 25,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitleContainer: {
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  cardTypeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    letterSpacing: 1,
  },
  shareCode: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  cardBalance: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    marginTop: 10,
  },
  addCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
    textAlign: 'center',
  },
  addCardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Expenses
  expensesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  expensesTitle: {
    fontSize: PixelRatio.getFontScale() > 1 ? 15 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 18 : 19,
  },
  expensesList: {
    flex: 1,
  },
  noExpenses: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noExpensesText: {
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: PixelRatio.getFontScale() > 1 ? 18 : 20,
    marginTop: 15,
    allowFontScaling: false,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  expenseItemPending: {
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  pendingText: {
    color: '#FF9500',
    fontSize: PixelRatio.getFontScale() > 1 ? 9 : 10,
    fontWeight: '600',
    marginBottom: 4,
    allowFontScaling: false,
  },
  expenseLeft: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },
  expenseMeta: {
    fontSize: PixelRatio.getFontScale() > 1 ? 11 : 12,
    color: '#666',
    marginTop: 2,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 14 : 15,
  },
  expenseDate: {
    fontSize: PixelRatio.getFontScale() > 1 ? 11 : 12,
    color: '#666',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 14 : 15,
  },
  expenseAmount: {
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '600',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },
  expenseNegative: {
    color: '#FF3B30',
  },
  expensePositive: {
    color: '#34C759',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 250,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: PixelRatio.getFontScale() > 1 ? 16 : 18,
    fontWeight: '700',
    color: '#333',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 20 : 22,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubtitle: {
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    color: '#666',
    marginBottom: 25,
    lineHeight: PixelRatio.getFontScale() > 1 ? 18 : 20,
    allowFontScaling: false,
  },
  modalButtons: {
    gap: 12,
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '600',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },
  modalSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 10,
  },
  modalSecondaryButtonText: {
    color: '#007AFF',
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '600',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },

  // Hamburger Button
  hamburgerButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hamburgerButtonTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hamburger Menu Modal
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuModalBackdropTouchable: {
    flex: 1,
  },
  menuModalContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '75%',
    backgroundColor: '#fff',
   
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  menuModalHeader: {
    backgroundColor: '#007AFF',
    paddingTop: 80,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderTopRightRadius: 20,
  },
  menuModalContent: {
    flex: 1,
    paddingTop: 20,
  },
  menuHeader: {
    backgroundColor: '#007AFF',
    paddingTop: 140,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  menuHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 15,
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    fontSize: PixelRatio.getFontScale() > 1 ? 15 : 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 18 : 19,
  },
  menuUserEmail: {
    fontSize: PixelRatio.getFontScale() > 1 ? 11 : 12,
    color: 'rgba(255,255,255,0.8)',
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 13 : 14,
  },
  menuContent: {
    flex: 1,
    paddingTop: 20,
  },
  menuItems: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  menuItemText: {
    fontSize: PixelRatio.getFontScale() > 1 ? 13 : 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 16 : 17,
  },
  menuSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 4,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  menuSubItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuSubItemText: {
    fontSize: PixelRatio.getFontScale() > 1 ? 11 : 12,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    allowFontScaling: false,
    lineHeight: PixelRatio.getFontScale() > 1 ? 13 : 14,
  },
  darkModeToggle: {
    padding: 4,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  toggleThumbOff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  menuCloseButton: {
    position: 'absolute',
    top: 140,
    right: 20,
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Mercado Pago / NU Inspired Styles
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  greetingHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greetingText: {
    fontSize: scaleFont(20),
    color: '#666',
    fontWeight: '400',
  },
  userNameText: {
    fontSize: scaleFont(20),
    color: '#004977',
    fontWeight: '600',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greetingText: {
    fontSize: scaleFont(16),
    color: '#666',
    fontWeight: '400',
  },
  userName: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 4,
  },

  // Main Balance Card
  balanceCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#004977',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  balanceCardGradient: {
    padding: 24,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceCardTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#fff',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardTypeBadgeText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  balanceCardBody: {
    marginBottom: 20,
  },
  balanceLabelCard: {
    fontSize: scaleFont(14),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceAmountCard: {
    fontSize: scaleFont(32),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  balanceCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNumberPreview: {
    fontSize: scaleFont(16),
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    letterSpacing: 2,
  },

  // Quick Actions
  quickActionsSection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },

  // Activity Section
  activitySection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: scaleFont(14),
    color: '#007AFF',
    fontWeight: '500',
  },
  activityList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  activityAmount: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#FF3B30',
  },
  noActivitiesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noActivitiesText: {
    fontSize: scaleFont(16),
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },


  // ===== CLEAN CAPITAL ONE STYLES =====
  
  // Main Container
  cleanMainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Top Section - Capital One Blue
  cleanTopSection: {
    backgroundColor: '#00487A',
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 0,
  },
  cleanTopContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cleanIconButton: {
    padding: 8,
  },
  cleanHeaderIcons: {
    flexDirection: 'row',
    gap: 16,
  },

  // Full Width Horizontal Divider
  fullWidthDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },

  // Clean Section (White Background)
  cleanSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  cleanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cleanSectionTitle: {
    fontSize: 19,
    color: '#1a1a1a',
    fontWeight: '700',
    marginBottom: 6,
  },
  cleanBalance: {
    fontSize: 19,
    color: '#1a1a1a',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 12,
  },
  cleanSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },

  // Quick Actions Grid
  cleanQuickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cleanActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  cleanActionButtonFirst: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    marginRight: 0,
  },
  cleanActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F4FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanActionText: {
    fontSize: 11,
    color: '#00487A',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  // Credit Card Info
  cleanCreditInfo: {
    marginTop: 4,
    marginBottom: 8,
  },
  cleanCreditLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  cleanCreditAmount: {
    fontSize: 19,
    color: '#1a1a1a',
    fontWeight: '700',
  },
  cleanCreditDetails: {
    marginTop: 6,
  },
  cleanCreditDetailText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },

  // Rectangle Buttons (MSI & My Cards)
  cleanRectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FA',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cleanRectButtonText: {
    fontSize: 15,
    color: '#00487A',
    fontWeight: '600',
    flex: 1,
  },

  // Simulate Loan Button
  cleanSimulateButton: {
    backgroundColor: '#00487A',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cleanSimulateButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Discover More
  cleanDiscoverTitle: {
    fontSize: 20,
    color: '#1a1a1a',
    fontWeight: '700',
    marginBottom: 16,
  },
  cleanDiscoverScroll: {
    gap: 16,
  },
  cleanDiscoverCard: {
    width: 240,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
  },
  cleanDiscoverImage: {
    height: 80,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cleanDiscoverCardTitle: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  cleanDiscoverCardText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },

  // OLD NU STYLES (keeping for compatibility but not used)
  nuMainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  nuHeader: {
    backgroundColor: '#6237A0',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  nuHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  nuIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nuHeaderIcons: {
    flexDirection: 'row',
    gap: 12,
  },

  // Nu Banner Card
  nuBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  nuBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nuBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#6237A0',
    fontWeight: '600',
    lineHeight: 18,
  },

  // Nu Account Card (Black Background)
  nuAccountCard: {
    backgroundColor: '#000000',
    marginHorizontal: 20,
    marginTop: -10,
    marginBottom: 30,
    borderRadius: 12,
    padding: 20,
  },
  nuAccountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nuAccountTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  nuAccountBalance: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Nu Quick Actions - Horizontal Scroll
  nuQuickActionsScroll: {
    marginBottom: 30,
  },
  nuQuickActionsContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  nuQuickActionItem: {
    alignItems: 'center',
    width: 90,
    position: 'relative',
  },
  nuQuickActionCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4A4A4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  nuQuickActionBadge: {
    position: 'absolute',
    top: 0,
    right: 8,
    backgroundColor: '#6237A0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nuQuickActionBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  nuQuickActionText: {
    fontSize: 12,
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Nu Section Container (with dividers)
  nuSectionContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  nuSectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  nuSectionTitle: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  nuSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
    lineHeight: 18,
  },
  nuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },

  // Nu Credit Info
  nuCreditInfo: {
    flex: 1,
  },
  nuCreditLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  nuCreditAmount: {
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: '600',
  },

  // Nu MSI Content
  nuMSIContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  // Nu Simulate Button
  nuSimulateButton: {
    backgroundColor: '#6237A0',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nuSimulateButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Nu Discover Section
  nuDiscoverSection: {
    marginTop: 16,
    marginBottom: 30,
  },
  nuDiscoverTitle: {
    fontSize: 22,
    color: '#1a1a1a',
    fontWeight: '700',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  nuDiscoverScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  nuDiscoverCard: {
    width: 280,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  nuDiscoverImagePlaceholder: {
    height: 140,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nuDiscoverCardContent: {
    padding: 20,
  },
  nuDiscoverCardTitle: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  nuDiscoverCardText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  nuDiscoverCardButton: {
    backgroundColor: '#6237A0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  nuDiscoverCardButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  nuDiscoverCardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nuDiscoverCardLinkText: {
    fontSize: 13,
    color: '#00487A',
    fontWeight: '600',
  },

  // Nu Feedback Section
  nuFeedbackSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  nuFeedbackText: {
    fontSize: 16,
    color: '#6237A0',
    fontWeight: '600',
  },

  // OLD STYLES (keeping for compatibility)
  checkingAccountCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  checkingAccountContent: {
    padding: 20,
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  accountIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  accountNickname: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  balanceSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 12,
  },
  balanceLabelMain: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginBottom: 6,
  },
  balanceAmountMain: {
    fontSize: 32,
    color: '#00487A',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  accountNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountNumberText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },

  // Quick Actions Grid (updated for 8 items)
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quickActionButton: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 20,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 11,
    color: '#1a1a1a',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Credit Card Section
  creditCardSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  creditCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  creditCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  creditCardTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  creditCardTitle: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '600',
    marginBottom: 3,
  },
  creditCardSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 18,
  },

  // My Cards Section
  myCardsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  myCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleBold: {
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: '700',
  },
  seeAllLink: {
    fontSize: 14,
    color: '#00487A',
    fontWeight: '600',
  },
  cardPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  miniCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#00487A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardPreviewTextContainer: {
    flex: 1,
  },
  cardPreviewTitle: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '600',
    marginBottom: 3,
  },
  cardPreviewSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Discover More Section
  discoverSection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  discoverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  discoverCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  discoverIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  discoverTextContainer: {
    flex: 1,
  },
  discoverTitle: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '700',
    marginBottom: 4,
  },
  discoverDescription: {
    fontSize: 13,
    color: '#666',
    fontWeight: '400',
    lineHeight: 18,
  },

  // Quick Actions Strip container (negative margin to cancel section padding)
  cleanQuickActionsStrip: {
    marginLeft: -20,
  },
  // Quick Actions Scroll
  cleanQuickActionsScroll: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 9,
    paddingVertical: 8,
  },
});

export default HomeScreen;