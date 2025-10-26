import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import TourOverlay from './TourOverlay';
import { colors } from '../styles/colors';

const TourStepWelcome = ({ visible, onNext, onSkip }) => {
  const stepData = {
    stepNumber: 1,
    totalSteps: 4,
    icon: 'hand-peace',
    title: 'Welcome to Nichtarm!',
    description: 'We\'ll guide you step by step to set up your account and start managing your finances intelligently.',
    buttonText: 'Get Started',
    content: (
      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <Icon name="credit-card" size={20} color={colors.primary} />
          <Text style={styles.featureText}>Create and manage cards</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="tag" size={20} color={colors.primary} />
          <Text style={styles.featureText}>Organize by categories</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="piggy-bank" size={20} color={colors.primary} />
          <Text style={styles.featureText}>Reach your goals with plans</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="chart-line" size={20} color={colors.primary} />
          <Text style={styles.featureText}>Analyze your finances</Text>
        </View>
      </View>
    ),
  };

  return (
    <TourOverlay
      visible={visible}
      step={stepData}
      onNext={onNext}
      onSkip={onSkip}
    />
  );
};

const styles = StyleSheet.create({
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  featureText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
});

export default TourStepWelcome;

