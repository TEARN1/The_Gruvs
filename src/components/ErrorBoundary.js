import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ERROR BOUNDARY]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>App Error</Text>
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
            <Text style={styles.errorText}>{this.state.error?.stack}</Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: '#ff4da6',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(255,77,166,0.1)',
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 4,
  },
});
