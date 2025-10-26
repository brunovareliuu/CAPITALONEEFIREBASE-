import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { navigationRef } from './src/utils/navigationRef';

import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';

// Context
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { TourProvider } from './src/context/TourContext';

// Screens
import WelcomeScreen from './src/auth/welcomescreen';
import LoginScreen from './src/auth/loginscreen';
import SignUpScreen from './src/auth/signupscreen';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import CreateCardScreen from './src/screens/CreateCardScreen';
import JoinCardScreen from './src/screens/JoinCardScreen';
import CreateCategoryScreen from './src/screens/CreateCategoryScreen';
import EditCardScreen from './src/screens/EditCardScreen';
import GeneralScreen from './src/screens/GeneralScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditCategoryScreen from './src/screens/EditCategoryScreen';
import EditExpenseScreen from './src/screens/EditExpenseScreen';
import AnimatedSplash from './src/components/AnimatedSplash';
import PlansScreen from './src/screens/PlansScreen';
import CreatePlanScreen from './src/screens/CreatePlanScreen';
import CreateGestionPlanScreen from './src/screens/CreateGestionPlanScreen';
import DetailsPlansScreen from './src/screens/DetailsPlansScreen';
import EditPlanScreen from './src/screens/EditPlanScreen';
import EditGestionPlanScreen from './src/screens/EditGestionPlanScreen'; // Import the new screen
import ConfirmPaymentScreen from './src/screens/ConfirmPaymentScreen';
import DetailsGestionPlansScreen from './src/screens/DetailsGestionPlansScreen';
import GestionInviteScreen from './src/screens/GestionInviteScreen';
import GestionAddPersonScreen from './src/screens/GestionAddPersonScreen';
import SettlementsScreen from './src/screens/SettlementsScreen';
import AddPlanContributionScreen from './src/screens/AddPlanContributionScreen';
import JoinPlanScreen from './src/screens/JoinPlanScreen';
import JoinPlanColorScreen from './src/screens/JoinPlanColorScreen';
import PlanInviteCodeScreen from './src/screens/PlanInviteCodeScreen';
import PendingTransactionsScreen from './src/screens/PendingTransactionsScreen';
import CategorizeTransactionScreen from './src/screens/CategorizeTransactionScreen';
import BudgetManagementScreen from './src/screens/BudgetManagementScreen';
import BudgetCreateScreen from './src/screens/BudgetCreateScreen';
import BudgetDetailsScreen from './src/screens/BudgetDetailsScreen';
import BudgetEditScreen from './src/screens/BudgetEditScreen';
import FrequencyTransactionsScreen from './src/screens/FrequencyTransactionsScreen';
import TarjetaDigitalScreen from './src/screens/capitalone/TarjetaDigitalScreen';
import TarjetaDigitalDetails from './src/screens/capitalone/TarjetaDigitalDetails';
import AccountQuizScreen from './src/screens/capitalone/AccountQuizScreen';
import BillsScreen from './src/screens/capitalone/BillsScreen';
import BillsDetailsScreen from './src/screens/BillsDetailsScreen';
import NickNameDebitScreen from './src/screens/NickNameDebitScreen';
import TransferScreen from './src/screens/TransferScreen';
import TransferSavingsScreen from './src/screens/TransferSavingsScreen';
import TransferConfirmationScreen from './src/screens/TransferConfirmationScreen';
import TransferHistoryScreen from './src/screens/TransferHistoryScreen';
import ReceiveMoneyScreen from './src/screens/ReceiveMoneyScreen';
import LoanScreen from './src/screens/LoanScreen';
import TransferContactSearchScreen from './src/screens/TransferContactSearchScreen';
import TransferAddContactScreen from './src/screens/TransferAddContactScreen';
import TransferAmountScreen from './src/screens/TransferAmountScreen';
import { getTarjetasDigitales, getUserProfile } from './src/services/firestoreService';
import { getCustomerAccounts } from './src/services/nessieService';

// removed WelcomeLoadingScreen per request

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();




const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: '#007AFF',
      tabBarInactiveTintColor: '#8E8E93',
      tabBarLabelStyle: styles.tabBarLabel,
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={HomeScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Icon name="home" size={size} color={color} />
        ),
        tabBarLabel: 'Home',
      }}
    />
    <Tab.Screen 
      name="General" 
      component={GeneralScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Icon name="chart-bar" size={size} color={color} />
        ),
        tabBarLabel: 'General',
      }}
    />
    <Tab.Screen 
      name="AddExpense" 
      component={AddExpenseScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Icon name="plus-circle" size={size} color={color} />
        ),
        tabBarLabel: 'Add',
      }}
    />
    <Tab.Screen 
      name="Plans" 
      component={PlansScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Icon name="bullseye" size={size} color={color} />
        ),
        tabBarLabel: 'Plans',
      }}
    />
    
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Icon name="user" size={size} color={color} />
        ),
        tabBarLabel: 'Profile',
      }}
    />
  </Tab.Navigator>
);

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: false,
    }}
  >
    <Stack.Screen 
      name="Welcome" 
      component={WelcomeScreen} 
      options={{
        headerLeft: () => null,
      }}
    />
    <Stack.Screen 
      name="Login" 
      component={LoginScreen}
      options={{
        gestureEnabled: false,
      }}
    />
    <Stack.Screen 
      name="SignUp" 
      component={SignUpScreen}
      options={{
        gestureEnabled: false,
      }}
    />
    {/* WelcomeLoading removed per request */}
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: true,
      // Smooth transitions for better UX
      transitionSpec: {
        open: {
          animation: 'timing',
          config: {
            duration: 350, // Smoother transition duration
            easing: require('react-native').Easing.out(require('react-native').Easing.cubic),
          },
        },
        close: {
          animation: 'timing',
          config: {
            duration: 300, // Slightly faster for closing
            easing: require('react-native').Easing.in(require('react-native').Easing.cubic),
          },
        },
      },
      // Smooth card style interpolation
      cardStyleInterpolator: ({ current, next, layouts }) => {
        return {
          cardStyle: {
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [layouts.screen.width, 0],
                }),
              },
            ],
          },
          overlayStyle: {
            opacity: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
          },
        };
      },
      presentation: 'card',
    }}
  >
    <Stack.Screen
      name="Main"
      component={TabNavigator}
      options={{
        headerLeft: () => null,
        gestureEnabled: false,
      }}
    />
    <Stack.Screen
      name="AccountQuiz"
      component={AccountQuizScreen}
      options={{
        headerShown: false,
        gestureEnabled: false,
      }}
    />
    <Stack.Screen
      name="NickNameDebit"
      component={NickNameDebitScreen}
      options={{
        headerShown: false,
        gestureEnabled: false,
      }}
    />
    <Stack.Screen
      name="TarjetaDigital"
      component={TarjetaDigitalScreen}
      options={{
        headerShown: false,
        gestureEnabled: false,
      }}
    />
    <Stack.Screen 
      name="CreatePlan" 
      component={CreatePlanScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="CreateGestionPlan" 
      component={CreateGestionPlanScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="EditPlan" 
      component={EditPlanScreen}
      options={{
        presentation: 'fullScreenModal',
      }}
    />
    <Stack.Screen 
      name="EditGestionPlan" 
      component={EditGestionPlanScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="ConfirmPayment" 
      component={ConfirmPaymentScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="DetailsPlansScreen" 
      component={DetailsPlansScreen}
      options={{
        presentation: 'card',
      }}
    />
    <Stack.Screen 
      name="DetailsGestionPlans" 
      component={DetailsGestionPlansScreen}
      options={{
        presentation: 'card',
        headerShown: false,
        gestureEnabled: true,
      }}
    />
    <Stack.Screen 
      name="GestionInvite" 
      component={GestionInviteScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="GestionAddPerson" 
      component={GestionAddPersonScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="Settlements" 
      component={SettlementsScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="AddPlanContribution" 
      component={AddPlanContributionScreen}
      options={{
        presentation: 'modal',
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="CreateCard" 
      component={CreateCardScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="JoinCard" 
      component={JoinCardScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="JoinPlan" 
      component={JoinPlanScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="JoinPlanColor" 
      component={JoinPlanColorScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen
      name="PlanInviteCode"
      component={PlanInviteCodeScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen
      name="PendingTransactions"
      component={PendingTransactionsScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="CategorizeTransaction"
      component={CategorizeTransactionScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="CreateCategory"
      component={CreateCategoryScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen
      name="BudgetManagement"
      component={BudgetManagementScreen}
      options={{
        headerShown: false,
      }}
    />
        <Stack.Screen
          name="BudgetCreate"
          component={BudgetCreateScreen}
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="BudgetDetails"
          component={BudgetDetailsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="BudgetEditScreen"
          component={BudgetEditScreen}
          options={{
          presentation: 'modal',
          headerShown: false,
        }}/>
    <Stack.Screen
      name="Bills"
      component={BillsScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="BillsDetails"
      component={BillsDetailsScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="FrequencyTransactionsScreen"
      component={FrequencyTransactionsScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="EditCard" 
      component={EditCardScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen 
      name="EditExpense" 
      component={EditExpenseScreen}
      options={{
        presentation: 'modal',
      }}
    />
    <Stack.Screen
      name="EditCategory"
      component={EditCategoryScreen}
      options={{
        // pantalla completa estilo tarjeta
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="TarjetaDigitalDetails"
      component={TarjetaDigitalDetails}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="ReceiveMoney"
      component={ReceiveMoneyScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="Loan"
      component={LoanScreen}
      name="TransferContactSearch"
      component={TransferContactSearchScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="TransferAddContact"
      component={TransferAddContactScreen}
      options={{
        headerShown: false,
        presentation: 'modal',
      }}
    />
    <Stack.Screen
      name="TransferAmount"
      component={TransferAmountScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="Transfer"
      component={TransferScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="TransferSavings"
      component={TransferSavingsScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="TransferConfirmation"
      component={TransferConfirmationScreen}
      options={{
        headerShown: false,
        presentation: 'card',
        gestureEnabled: false,
      }}
    />
    <Stack.Screen
      name="TransferHistory"
      component={TransferHistoryScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  </Stack.Navigator>
);

const linking = {
  prefixes: ['https://nichtarm.app', 'nichtarm://'],
  config: {
    screens: {
      JoinPlan: 'invite/:code',
    },
  },
};

// Componente que maneja la navegación principal con verificación de cuentas
const AppNavigation = () => {
  const { user, loading, forceNavigationUpdate } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);
  const [completedAccountQuiz, setCompletedAccountQuiz] = React.useState(false);
  const [hasNessieAccount, setHasNessieAccount] = React.useState(false);
  const [hasTarjetasDigitales, setHasTarjetasDigitales] = React.useState(false);
  const [checkingAccount, setCheckingAccount] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState(null);

  React.useEffect(() => {
    if (!loading) {
      // No mostrar splash si estamos en pantalla de bienvenida
      // para que no interfiera con la animación del logo
      const timer = setTimeout(() => setShowSplash(false), user ? 200 : 0);
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  // Verificar si el usuario tiene cuentas en Nessie
  React.useEffect(() => {
    if (user && !loading) {
      setCheckingAccount(true);

      const checkUserStatus = async () => {
        try {
          // Get user profile to get nessieCustomerId
          const userDoc = await getUserProfile(user.uid);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const nessieCustomerId = userData.nessieCustomerId;

            // Verificar si completó el quiz de cuenta
            setCompletedAccountQuiz(userData.completedAccountQuiz || false);

            if (nessieCustomerId) {
              // Check if user has accounts in Nessie
              const accounts = await getCustomerAccounts(nessieCustomerId);
              setHasNessieAccount(accounts && accounts.length > 0);
            } else {
              setHasNessieAccount(false);
            }
          }

          // Check if user has tarjetas digitales
          const unsubscribe = getTarjetasDigitales(user.uid, (tarjetas) => {
            setHasTarjetasDigitales(tarjetas.length > 0);
          });

          return unsubscribe;
        } catch (error) {
          console.error('Error checking user status:', error);
          setCompletedAccountQuiz(false);
          setHasNessieAccount(false);
          setHasTarjetasDigitales(false);
        } finally {
          setCheckingAccount(false);
        }
      };

      const unsubscribe = checkUserStatus();
      return () => {
        if (unsubscribe && typeof unsubscribe.then === 'function') {
          unsubscribe.then(unsub => unsub && unsub());
        }
      };
    }
  }, [user, loading, forceNavigationUpdate]);

  // Handle pending navigation when account quiz is completed
  React.useEffect(() => {
    if (completedAccountQuiz && pendingNavigation) {
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        navigationRef.current?.navigate(pendingNavigation.screen, pendingNavigation.params);
        setPendingNavigation(null);
      }, 200);
    }
  }, [completedAccountQuiz, pendingNavigation]);

  if (loading || checkingAccount) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer ref={navigationRef} linking={linking}>
        {!user ? (
          <AuthStack />
        ) : !completedAccountQuiz ? (
          // Usuario autenticado pero NO ha completado el quiz -> va directamente a elegir nickname para débito
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="NickNameDebit" component={NickNameDebitScreen} />
          </Stack.Navigator>
        ) : completedAccountQuiz && !hasTarjetasDigitales && hasNessieAccount ? (
          // Usuario que completó el quiz pero sin tarjeta digital -> crear tarjeta
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="TarjetaDigital" component={TarjetaDigitalScreen} />
          </Stack.Navigator>
        ) : (
          // Usuario con cuenta y tarjeta -> va a la app completa
          <AppStack />
        )}
      </NavigationContainer>
      {showSplash && user && <AnimatedSplash />}
    </>
  );
};

const Navigation = () => {
  return <AppNavigation />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TourProvider>
          <StatusBar style="light" />
          <Navigation />
        </TourProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    height: 90,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  customTabButton: {
    top: -25, // Adjust this value to position the button vertically
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF', // Reverted to original color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },

});
