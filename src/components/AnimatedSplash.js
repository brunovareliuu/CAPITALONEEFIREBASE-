import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';

const AnimatedSplash = () => {
  const { width, height } = useWindowDimensions();
  const scale1 = useRef(new Animated.Value(0)).current;
  const scale2 = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.stagger(150, [
        Animated.spring(scale1, { toValue: 3, useNativeDriver: true, bounciness: 12 }),
        Animated.spring(scale2, { toValue: 3.5, useNativeDriver: true, bounciness: 12 })
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true })
    ]).start();
  }, [scale1, scale2, opacity]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>      
      <View style={[styles.center, { width, height }]}>
        <Animated.View style={[styles.circle, styles.circle1, { transform: [{ scale: scale1 }] }]} />
        <Animated.View style={[styles.circle, styles.circle2, { transform: [{ scale: scale2 }] }]} />
        <Text style={styles.title}>nichtarm</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  circle1: {
    backgroundColor: '#E3F2FD',
  },
  circle2: {
    backgroundColor: '#BBDEFB',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#007AFF',
    letterSpacing: 1,
  },
});

export default AnimatedSplash;
