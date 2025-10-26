import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const TourOverlay = ({ visible, step, onNext, onSkip, showNextButton = true, showSkipButton = true }) => {
  if (!step) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        {/* Dark background */}
        <View style={styles.backdrop} />

        {/* Tooltip Container */}
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltip}>
            {/* Step indicator */}
            {step.stepNumber && (
              <View style={styles.stepIndicator}>
                <Text style={styles.stepText}>
                  Step {step.stepNumber} of {step.totalSteps}
                </Text>
              </View>
            )}

            {/* Icon */}
            {step.icon && (
              <View style={styles.iconContainer}>
                <Icon name={step.icon} size={48} color={colors.primary} />
              </View>
            )}

            {/* Title */}
            <Text style={styles.title}>{step.title}</Text>

            {/* Description */}
            <Text style={styles.description}>{step.description}</Text>

            {/* Additional content */}
            {step.content && (
              <View style={styles.additionalContent}>
                {step.content}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {showSkipButton && (
                <TouchableOpacity
                  style={[styles.button, styles.skipButton]}
                  onPress={onSkip}
                  activeOpacity={0.8}
                >
                  <Text style={styles.skipButtonText}>Saltar Tutorial</Text>
                </TouchableOpacity>
              )}

              {showNextButton && (
                <TouchableOpacity
                  style={[styles.button, styles.nextButton]}
                  onPress={onNext}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextButtonText}>
                    {step.buttonText || 'Continuar'}
                  </Text>
                  <Icon name="arrow-right" size={16} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  tooltipContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tooltip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  stepIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  additionalContent: {
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  nextButton: {
    backgroundColor: colors.primary,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TourOverlay;

