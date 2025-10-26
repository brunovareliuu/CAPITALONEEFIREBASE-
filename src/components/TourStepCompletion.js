import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import TourOverlay from './TourOverlay';
import { colors } from '../styles/colors';

const TourStepCompletion = ({ visible, onNext, onSkip }) => {
  const stepData = {
    stepNumber: 4,
    totalSteps: 4,
    icon: 'trophy',
    title: 'Congratulations!',
    description: 'You\'ve completed the basic setup of Nichtarm! Now you\'re all set to manage your finances.',
    buttonText: 'Explore the App',
    content: (
      <View style={styles.container}>
        <View style={styles.completionCard}>
          <Icon name="check-circle" size={24} color={colors.success} />
          <Text style={styles.completionText}>Card created</Text>
        </View>
        <View style={styles.completionCard}>
          <Icon name="check-circle" size={24} color={colors.success} />
          <Text style={styles.completionText}>Category created</Text>
        </View>
        <View style={styles.completionCard}>
          <Icon name="check-circle" size={24} color={colors.success} />
          <Text style={styles.completionText}>Plan created</Text>
        </View>
        
        <View style={styles.separator} />
        
        <Text style={styles.exploreTitle}>Explore more features:</Text>
        <View style={styles.featureItem}>
          <Icon name="chart-pie" size={18} color={colors.secondary} />
          <Text style={styles.featureText}>Budgets to control spending</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="chart-bar" size={18} color={colors.secondary} />
          <Text style={styles.featureText}>Dashboard with detailed analysis</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="sync-alt" size={18} color={colors.secondary} />
          <Text style={styles.featureText}>Recurring transactions</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="users" size={18} color={colors.secondary} />
          <Text style={styles.featureText}>Collaborative plans</Text>
        </View>
      </View>
    ),
  };

  return (
    <TourOverlay
      visible={visible}
      step={stepData}
      onNext={onNext}
      onSkip={null}
      showSkipButton={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  completionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 10,
  },
  completionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  exploreTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
});

export default TourStepCompletion;

