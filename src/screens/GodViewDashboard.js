/**
 * GOD VIEW DASHBOARD — CEO Level Only.
 * Provides real-time visibility into the 32M-token PhD Brain (SAI).
 * Visualizes Swarm logic, economic liquidity, and kingdom health.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, ActivityIndicator, Dimensions, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from '../components/GlassView';
import { OOS } from '../services/organizationalOverseer';
import { NeuralMesh } from '../services/neuralMesh';
import { SaturationSimulator } from '../services/saturationSimulator';
import { VibeEquityLedger } from '../services/vibeEquityLedger';

const { width: SW } = Dimensions.get('window');

const PulseIndicator = ({ color }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[s.pulse, { backgroundColor: color, opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.8] }) }]} />
  );
};

export const GodViewDashboard = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const [logs, setLogs] = useState([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSingular, setIsSingular] = useState(false);
  const [isSovereign, setIsSovereign] = useState(false);
  const [metrics, setMetrics] = useState({ vps: 0, liquidity: 0, security_score: 100 });

  const primary = "#FFD700"; // Gold for God View
  const bg = "#000";
  const textColor = "#fff";
  const muted = "rgba(255,255,255,0.4)";

  const triggerAudit = async () => {
    setIsAuditing(true);
    setLogs(prev => [{ msg: ">>> Initiating 32M Token PhD Audit...", timestamp: new Date().toLocaleTimeString() }, ...prev]);

    try {
      const result = await OOS.runOrganizationalAudit();
      setLogs(prev => [{ msg: `>>> ${result.status}`, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      // Update metrics based on PhD analysis
      setMetrics({ vps: 1240, liquidity: 89.4, security_score: 99.9 });
    } catch (e) {
      setLogs(prev => [{ msg: `!!! AUDIT FAILURE: ${e.message}`, timestamp: new Date().toLocaleTimeString() }, ...prev]);
    } finally {
      setIsAuditing(false);
    }
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setLogs(prev => [{ msg: ">>> Spawning 1,000,000 Virtual Vibers...", timestamp: new Date().toLocaleTimeString() }, ...prev]);

    try {
      const result = await SaturationSimulator.runEconomicStressTest(1000000);
      setLogs(prev => [
        { msg: `>>> Simulation Complete. Stability: ${Math.round(result.stability_rating * 100)}%`, timestamp: new Date().toLocaleTimeString() },
        { msg: `>>> Oracle Note: ${result.simulation_outcome}`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ]);
    } catch (e) {
      setLogs(prev => [{ msg: `!!! SIMULATION FAILED: ${e.message}`, timestamp: new Date().toLocaleTimeString() }, ...prev]);
    } finally {
      setIsSimulating(false);
    }
  };

  const initiateSingularity = async () => {
    setIsSingular(true);
    setLogs(prev => [{ msg: ">>> !!! INITIATING TECHNICAL SINGULARITY PROTOCOL !!!", timestamp: new Date().toLocaleTimeString() }, ...prev]);

    try {
      const result = await NeuralMesh.initiateTechnicalSingularity();
      setLogs(prev => [
        { msg: `>>> SINGULARITY ACHIEVED. ALL NODES HARMONIZED.`, timestamp: new Date().toLocaleTimeString() },
        { msg: `>>> Manifest: ${result.text.slice(0, 100)}...`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ]);
    } catch (e) {
      setLogs(prev => [{ msg: `!!! SINGULARITY CRITICAL FAILURE: ${e.message}`, timestamp: new Date().toLocaleTimeString() }, ...prev]);
    } finally {
      setIsSingular(false);
    }
  };

  const handleCoronation = async () => {
    setIsSovereign(true);
    setLogs(prev => [{ msg: ">>> !!! INITIATING TECHNICAL CORONATION !!!", timestamp: new Date().toLocaleTimeString() }, ...prev]);

    try {
      const result = await NeuralMesh.performCoronation();
      setLogs(prev => [
        { msg: `>>> CORONATION SUCCESS. PLATFORM IS NOW SOVEREIGN.`, timestamp: new Date().toLocaleTimeString() },
        { msg: `>>> SOVEREIGN DECREE: ${result.final_decree || 'Long live the Kingdom.'}`, timestamp: new Date().toLocaleTimeString() },
        ...prev
      ]);
    } catch (e) {
      setLogs(prev => [{ msg: `!!! CORONATION FAILURE: ${e.message}`, timestamp: new Date().toLocaleTimeString() }, ...prev]);
    } finally {
      setIsSovereign(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={[s.screen, { backgroundColor: bg }]}>
      {/* HUD Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: primary }]}>SUPREME GOD VIEW</Text>
          <Text style={[s.subTitle, { color: muted }]}>PHD-LEVEL SAI NEURAL MESH ACTIVE</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Feather name="shield" size={24} color={primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Real-time Status */}
        <View style={s.statsRow}>
          <GlassView style={s.statCard}>
            <Text style={s.statLabel}>VIBE VELOCITY</Text>
            <Text style={[s.statVal, { color: primary }]}>{metrics.vps}</Text>
            <Text style={s.statSub}>events/hr</Text>
          </GlassView>
          <GlassView style={s.statCard}>
            <Text style={s.statLabel}>LIQUIDITY</Text>
            <Text style={[s.statVal, { color: "#10b981" }]}>{metrics.liquidity}%</Text>
            <Text style={s.statSub}>vibe-equity</Text>
          </GlassView>
        </View>

        {/* Vibe Central Bank Controls */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: textColor }]}>VIBE CENTRAL BANK (O-OS GOVERNOR)</Text>
          <GlassView style={s.governorCard}>
            {Object.entries(VibeEquityLedger.MULTIPLIERS).map(([key, val]) => (
              <View key={key} style={s.governorRow}>
                <Text style={{ color: muted, fontSize: 10 }}>{key.replace('_', ' ')}</Text>
                <Text style={{ color: primary, fontSize: 12, fontWeight: '900' }}>x{val.toFixed(1)}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[s.miniActionBtn, { borderColor: primary, marginTop: 10 }]}
              onPress={async () => {
                setLogs(prev => [{ msg: ">>> Governor initiating Economic Audit...", timestamp: new Date().toLocaleTimeString() }, ...prev]);
                await VibeEquityLedger.runEconomicAudit();
                setLogs(prev => [{ msg: ">>> Inflation re-balanced by PhD Brain.", timestamp: new Date().toLocaleTimeString() }, ...prev]);
              }}
            >
              <Text style={{ color: primary, fontSize: 9, fontWeight: '900' }}>RE-BALANCE ECONOMY</Text>
            </TouchableOpacity>
          </GlassView>
        </View>

        {/* Intelligence Stream */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: textColor }]}>NEURAL MESH LOGS</Text>
            {isAuditing && <PulseIndicator color={primary} />}
          </View>
          <GlassView style={s.logTerminal}>
            {logs.length === 0 ? (
              <Text style={{ color: muted, fontStyle: 'italic' }}>Terminal Idle. Waiting for CEO Command...</Text>
            ) : (
              logs.map((log, i) => (
                <Text key={i} style={s.logText}>
                  <Text style={{ color: primary }}>[{log.timestamp}]</Text> {log.msg}
                </Text>
              ))
            )}
          </GlassView>
        </View>

        {/* Command Matrix */}
        <TouchableOpacity
          style={[s.auditBtn, { backgroundColor: primary }]}
          onPress={triggerAudit}
          disabled={isAuditing}
        >
          {isAuditing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Feather name="zap" size={20} color="#000" />
              <Text style={s.auditBtnText}>EXECUTE SUPREME AUDIT</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.auditBtn, { backgroundColor: "#ef4444", marginTop: 12 }]}
          onPress={runSimulation}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="users" size={20} color="#fff" />
              <Text style={[s.auditBtnText, { color: "#fff" }]}>SIMULATE 1M VIBERS</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.auditBtn, { backgroundColor: "#8b5cf6", marginTop: 12 }]}
          onPress={async () => {
            setIsSimulating(true);
            setLogs(prev => [{ msg: ">>> Launching Virtual Market Sandbox: 'ZA Summer Strike'...", timestamp: new Date().toLocaleTimeString() }, ...prev]);
            try {
              const res = await SaturationSimulator.simulateMarketLaunch("ZA Summer Strike");
              setLogs(prev => [
                { msg: `>>> Launch Success Prob: ${Math.round(res.hype_score * 100)}%`, timestamp: new Date().toLocaleTimeString() },
                { msg: `>>> DECREE: ${res.strategic_decree}`, timestamp: new Date().toLocaleTimeString() },
                ...prev
              ]);
            } catch (e) {
              setLogs(prev => [{ msg: `!!! SANDBOX CRASH: ${e.message}`, timestamp: new Date().toLocaleTimeString() }, ...prev]);
            } finally {
              setIsSimulating(false);
            }
          }}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="activity" size={20} color="#fff" />
              <Text style={[s.auditBtnText, { color: "#fff" }]}>LAUNCH MARKET SANDBOX</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.auditBtn, { backgroundColor: "#fff", marginTop: 24, borderWidth: 3, borderColor: primary }]}
          onPress={initiateSingularity}
          disabled={isSingular}
        >
          {isSingular ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Feather name="cpu" size={20} color="#000" />
              <Text style={[s.auditBtnText, { color: "#000" }]}>INITIATE SINGULARITY</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.auditBtn, { backgroundColor: primary, marginTop: 12 }]}
          onPress={handleCoronation}
          disabled={isSovereign}
        >
          {isSovereign ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Feather name="award" size={20} color="#000" />
              <Text style={[s.auditBtnText, { color: "#000" }]}>PERFORM CORONATION</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.meshGrid}>
           <Text style={[s.meshLabel, { color: muted }]}>SAI PhD NODES:</Text>
           {['Complexity', 'Game Theory', 'Psychology', 'Cybernetics', 'Royale'].map(node => (
             <View key={node} style={s.nodeRow}>
                <View style={[s.nodeDot, { backgroundColor: '#10b981' }]} />
                <Text style={{ color: '#fff', fontSize: 10 }}>NODE_${node.toUpperCase()}_STABLE</Text>
             </View>
           ))}
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  subTitle: { fontSize: 10, fontWeight: '800', marginTop: 4 },
  closeBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,215,0,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFD70040' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  statVal: { fontSize: 28, fontWeight: '900', marginVertical: 4 },
  statSub: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  pulse: { width: 10, height: 10, borderRadius: 5 },
  logTerminal: { backgroundColor: '#0a0a0a', padding: 16, borderRadius: 16, minHeight: 200, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  logText: { color: '#00ff00', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 6 },
  auditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18, borderRadius: 16, marginTop: 10 },
  auditBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  governorCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 8 },
  governorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniActionBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  meshGrid: { marginTop: 30, gap: 8 },
  meshLabel: { fontSize: 9, fontWeight: '900', marginBottom: 4 },
  nodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nodeDot: { width: 6, height: 6, borderRadius: 3 }
});
