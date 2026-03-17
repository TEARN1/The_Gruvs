import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, Easing, Platform, Pressable, FlatList } from 'react-native';

// ─── Glow Button ────────────────────────────────────────────────────────────
export function GlowButton({ onPress, children, style, themeAcc, disabled }) {
    const [hover, setHover] = useState(false);
    const scale = new Animated.Value(1);

    const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
    const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Pressable
            onPress={onPress} disabled={disabled}
            onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
            onPressIn={handlePressIn} onPressOut={handlePressOut}
        >
            <Animated.View style={[
                style,
                { transform: [{ scale }] },
                hover && Platform.OS === 'web' && {
                    boxShadow: `0px 0px 15px ${themeAcc}`,
                    borderColor: themeAcc,
                }
            ]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

// ─── Toast System ───────────────────────────────────────────────────────────
export function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((msg, type = 'success') => {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);
    return { toasts, addToast };
}

export function Toast({ toasts }) {
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    return (
        <View style={toastStyles.container}>
            {toasts.map(t => (
                <Animated.View key={t.id} style={[toastStyles.toast, { backgroundColor: colors[t.type] || colors.success }]}>
                    <Text style={toastStyles.toastText}>{t.msg}</Text>
                </Animated.View>
            ))}
        </View>
    );
}

const toastStyles = StyleSheet.create({
    container: { position: 'absolute', top: 60, right: 15, zIndex: 9999, alignItems: 'flex-end', maxWidth: '90%' },
    toast: { marginBottom: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    toastText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ─── Confirm Dialog ─────────────────────────────────────────────────────────
export function ConfirmDialog({ visible, title, message, onConfirm, onCancel, danger }) {
    if (!visible) return null;
    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={dlgStyles.overlay}>
                <View style={dlgStyles.box}>
                    <Text style={dlgStyles.title}>{title}</Text>
                    <Text style={dlgStyles.msg}>{message}</Text>
                    <View style={dlgStyles.row}>
                        <TouchableOpacity style={dlgStyles.cancel} onPress={onCancel}><Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[dlgStyles.confirm, danger && { backgroundColor: '#ef4444' }]} onPress={onConfirm}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const dlgStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    box: { backgroundColor: '#fff', borderRadius: 22, padding: 24, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    title: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 10 },
    msg: { fontSize: 14, color: '#555', marginBottom: 20, lineHeight: 20 },
    row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    cancel: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: '#f0f0f0' },
    confirm: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, backgroundColor: '#ff4da6' },
});

// ─── Report Modal ───────────────────────────────────────────────────────────
import { REPORT_REASONS } from './data';

export function ReportModal({ visible, onSubmit, onCancel, theme }) {
    const [reason, setReason] = useState('');
    if (!visible) return null;

    return (
        <Modal transparent animationType="slide" visible={visible}>
            <View style={dlgStyles.overlay}>
                <View style={[dlgStyles.box, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                    <Text style={[dlgStyles.title, { color: theme.text }]}>🚩 Report Content</Text>
                    {REPORT_REASONS.map(r => (
                        <TouchableOpacity
                            key={r}
                            style={[
                                { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: theme.border, marginBottom: 8 },
                                reason === r && { backgroundColor: '#ff4444', borderColor: '#ff4444' }
                            ]}
                            onPress={() => setReason(r)}
                        >
                            <Text style={{ color: reason === r ? '#fff' : theme.text, fontWeight: '600' }}>{r}</Text>
                        </TouchableOpacity>
                    ))}
                    <View style={[dlgStyles.row, { marginTop: 15 }]}>
                        <TouchableOpacity style={dlgStyles.cancel} onPress={onCancel}><Text style={{ color: '#666' }}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[dlgStyles.confirm, { backgroundColor: '#ff4444' }]} onPress={() => { if (reason) { onSubmit(reason); setReason(''); } }}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Search Suggestions Component ───────────────────────────────────────────
export function SearchSuggestions({ suggestions, onSuggestSelected, theme, visible }) {
    if (!visible || !suggestions?.length) return null;

    return (
        <View style={[suggestionStyles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <FlatList
                data={suggestions}
                keyExtractor={(item, idx) => `${item}-${idx}`}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={suggestionStyles.item}
                        onPress={() => onSuggestSelected(item)}
                    >
                        <Text style={[suggestionStyles.text, { color: theme.text }]}>🔍 {item}</Text>
                    </TouchableOpacity>
                )}
                scrollEnabled={false}
            />
        </View>
    );
}

const suggestionStyles = StyleSheet.create({
    container: { maxHeight: 200, borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginHorizontal: 15, marginTop: 5 },
    item: { paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    text: { fontSize: 13, fontWeight: '500' }
});

// ─── Loading Spinner ───────────────────────────────────────────────────────
export function LoadingSpinner({ color = '#ff4da6' }) {
    const spin = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, [spin]);

    const spinAnim = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={{ transform: [{ rotate: spinAnim }], width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: color, borderTopColor: 'transparent' }} />
    );
}

