import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTour } from '../context/TourContext';
import {
  getUserProfile,
  getCards,
  getPlans,
  getBudgets,
} from '../services/firestoreService';
import { StatusBar } from 'expo-status-bar';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 380;
const isTablet = screenWidth >= 768;

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { resetTour, startTour } = useTour();
  const [profile, setProfile] = useState(null);
  const [cards, setCards] = useState([]);
  const [plans, setPlans] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const snap = await getUserProfile(user.uid);
        setProfile(snap.exists() ? snap.data() : {});
      } catch {}
    })();

    const unsubCards = getCards(user.uid, setCards);
    const unsubPlans = getPlans(user.uid, setPlans);
    const unsubBudgets = getBudgets(user.uid, setBudgets);

    return () => {
      unsubCards && unsubCards();
      unsubPlans && unsubPlans();
      unsubBudgets && unsubBudgets();
    };
  }, [user]);

  const stats = useMemo(() => ({
    totalCards: cards.length,
    savingsPlans: plans.filter(p => p.kind === 'savings').length,
    managementPlans: plans.filter(p => p.kind === 'gestion').length,
    budgets: budgets.length,
  }), [cards, plans, budgets]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleRestartTutorial = () => {
    Alert.alert(
      'Restart Tutorial',
      'This will restart the tutorial from the beginning. Do you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'default',
          onPress: async () => {
            await resetTour();
            startTour();
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  const StatBlock = ({ icon, title, value, color }) => (
    <View style={styles.statBlock}>
      <Icon name={icon} size={20} color={color} style={{ marginRight: 12 }} />
      <View>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
      </View>
    </View>
  );

  const SettingItem = ({ icon, title, value, onPress, hasSwitch, switchValue, onSwitchChange }) => (
    <TouchableOpacity onPress={onPress} style={[styles.settingItem, { borderBottomColor: colors.backgroundSecondary }]} disabled={!onPress}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Icon name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={[styles.settingText, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>}
        {hasSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        ) : (
          onPress && <Icon name="chevron-right" size={16} color={colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    scrollContent: {
      paddingHorizontal: isSmallScreen ? 15 : isTablet ? 40 : 20,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'flex-start',
      paddingVertical: isSmallScreen ? 15 : 20,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 20 : isTablet ? 26 : 22,
      fontWeight: 'bold',
      color: colors.text,
    },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: isSmallScreen ? 16 : 20,
      padding: isSmallScreen ? 16 : isTablet ? 24 : 20,
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    profileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSmallScreen ? 12 : 15,
    },
    avatar: {
      width: isSmallScreen ? 50 : isTablet ? 70 : 60,
      height: isSmallScreen ? 50 : isTablet ? 70 : 60,
      borderRadius: isSmallScreen ? 25 : isTablet ? 35 : 30,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: isSmallScreen ? 20 : isTablet ? 28 : 24,
      fontWeight: 'bold',
      color: '#fff',
    },
    profileName: {
      fontSize: isSmallScreen ? 16 : isTablet ? 20 : 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    profileEmail: {
      fontSize: isSmallScreen ? 12 : isTablet ? 16 : 14,
      color: colors.textSecondary,
    },
    editButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingVertical: isSmallScreen ? 10 : 12,
      borderRadius: isSmallScreen ? 12 : 16,
      alignSelf: 'flex-start',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    editButtonLeft: {
      backgroundColor: colors.primary,
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingVertical: isSmallScreen ? 10 : 12,
      borderRadius: isSmallScreen ? 12 : 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    editButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: isSmallScreen ? 13 : 14,
    },
    statsContainer: {
      backgroundColor: colors.card,
      borderRadius: isSmallScreen ? 16 : 20,
      padding: isSmallScreen ? 12 : isTablet ? 20 : 15,
      marginBottom: 15,
    },
    statBlock: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    statTitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 25,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 15,
      paddingHorizontal: 5,
    },
    actionsGrid: {
      gap: isSmallScreen ? 12 : 15,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: isSmallScreen ? 8 : 10,
    },
    infoGrid: {
      gap: isSmallScreen ? 12 : 15,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: isSmallScreen ? 8 : 10,
    },
    infoButton: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 15 : isTablet ? 20 : 18,
      alignItems: 'flex-start',
      gap: isSmallScreen ? 6 : 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    infoContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSmallScreen ? 8 : 10,
    },
    infoValue: {
      fontSize: isSmallScreen ? 20 : isTablet ? 24 : 22,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 4,
    },
    infoLabel: {
      fontSize: isSmallScreen ? 11 : isTablet ? 13 : 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 12 : isTablet ? 18 : 15,
      alignItems: 'center',
      gap: isSmallScreen ? 6 : 8,
    },
    actionText: {
      fontSize: isSmallScreen ? 12 : isTablet ? 16 : 14,
      fontWeight: '600',
      color: colors.text,
    },
    settingsGroup: {
      backgroundColor: colors.card,
      borderRadius: isSmallScreen ? 12 : 16,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: isSmallScreen ? 10 : 12,
      paddingHorizontal: isSmallScreen ? 12 : 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.backgroundSecondary,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSmallScreen ? 12 : 15,
    },
    settingIconContainer: {
      width: isSmallScreen ? 32 : 36,
      height: isSmallScreen ? 32 : 36,
      borderRadius: 10,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingText: {
      fontSize: isSmallScreen ? 14 : isTablet ? 18 : 16,
      fontWeight: '500',
      color: colors.text,
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    settingValue: {
      fontSize: isSmallScreen ? 14 : isTablet ? 18 : 16,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    signOutButton: {
      backgroundColor: colors.card,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 15 : isTablet ? 20 : 18,
      alignItems: 'center',
      marginTop: 10,
    },
    signOutButtonText: {
      color: colors.error,
      fontSize: isSmallScreen ? 14 : isTablet ? 18 : 16,
      fontWeight: '600',
    },
    versionText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: isSmallScreen ? 20 : 30,
      fontSize: isSmallScreen ? 10 : 12,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Icon name="user" size={isSmallScreen ? 20 : isTablet ? 28 : 24} color="#fff" />
            </View>
            <View>
              <Text style={styles.profileName}>{profile?.displayName || user?.email?.split('@')[0] || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <TouchableOpacity style={styles.infoButton} activeOpacity={0.8}>
                <View style={styles.infoContent}>
                  <Icon name="piggy-bank" size={20} color={colors.success} />
                  <Text style={styles.infoValue}>{stats.savingsPlans}</Text>
                </View>
                <Text style={styles.infoLabel}>Savings Plans</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoButton} activeOpacity={0.8}>
                <View style={styles.infoContent}>
                  <Icon name="tasks" size={20} color={colors.secondary} />
                  <Text style={styles.infoValue}>{stats.managementPlans}</Text>
                </View>
                <Text style={styles.infoLabel}>Group Plans</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoRow}>
              <TouchableOpacity style={styles.infoButton} activeOpacity={0.8}>
                <View style={styles.infoContent}>
                  <Icon name="credit-card" size={20} color={colors.primary} />
                  <Text style={styles.infoValue}>{stats.totalCards}</Text>
                </View>
                <Text style={styles.infoLabel}>Active Cards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoButton} activeOpacity={0.8}>
                <View style={styles.infoContent}>
                  <Icon name="chart-pie" size={20} color={colors.warning} />
                  <Text style={styles.infoValue}>{stats.budgets}</Text>
                </View>
                <Text style={styles.infoLabel}>Budgets</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateCard', { isShared: false })}>
                <Icon name="plus" size={18} color={colors.primary} />
                <Text style={styles.actionText}>Add Card</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreatePlan')}>
                <Icon name="bullseye" size={18} color={colors.success} />
                <Text style={styles.actionText}>New Plan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateCategory')}>
                <Icon name="tag" size={18} color={colors.secondary} />
                <Text style={styles.actionText}>Add Category</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('BudgetCreate')}>
                <Icon name="chart-line" size={18} color={colors.warning} />
                <Text style={styles.actionText}>Add Budget</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsGroup}>
            <SettingItem icon="moon" title="Dark Mode" hasSwitch switchValue={isDarkMode} onSwitchChange={toggleTheme} />
            <SettingItem icon="graduation-cap" title="Restart Tutorial" onPress={handleRestartTutorial} />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;