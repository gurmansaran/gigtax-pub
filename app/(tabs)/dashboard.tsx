import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import MileageTracker from '@/components/tracker/MileageTracker';
import { getTrips, updateTrip, type Trip } from '@/lib/tripStore';
import { initializeGeofencing } from '@/lib/geofencingService';
import { useTaxProfile } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getExportPreview,
  exportMileagePDF,
  exportMileageCSV,
  shareMileageExport,
  getIRSMileageRate,
  BUSINESS_PURPOSE_OPTIONS,
} from '@/lib/mileageExportService';
import { DashboardSkeleton } from '@/components/ui/Skeletons';
import { MileageEmpty } from '@/components/ui/EmptyStates';
import { FadeInView } from '@/components/ui/AnimatedComponents';

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { taxProfile } = useTaxProfile();
  const { colors } = useRobinhoodTheme();

  // Mileage export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [exportDateRange, setExportDateRange] = useState<'this_year' | 'last_year' | 'this_quarter'>('this_year');
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState({ totalTrips: 0, totalMiles: 0, deduction: 0, totalHours: 0 });

  // Business purpose edit state
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [showPurposeModal, setShowPurposeModal] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const loadedTrips = await getTrips();
      const validTrips = loadedTrips.filter((trip) => {
        if (!trip.date || !trip.startTime || !trip.endTime) return false;
        const date = new Date(trip.date);
        return !isNaN(date.getTime()) && date.getTime() > 0;
      });
      setTrips(validTrips);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taxProfile?.address) {
      const cleanup = initializeGeofencing(() => { });
      return cleanup;
    }
  }, [taxProfile?.address]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const getDateRange = (): { start: string; end: string } => {
    const now = new Date();
    const year = now.getFullYear();

    switch (exportDateRange) {
      case 'last_year':
        return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
      case 'this_quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const qStart = new Date(year, quarter * 3, 1);
        const qEnd = new Date(year, quarter * 3 + 3, 0);
        return {
          start: qStart.toISOString().split('T')[0],
          end: qEnd.toISOString().split('T')[0],
        };
      }
      default:
        return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
  };

  const loadExportPreview = useCallback(async () => {
    const { start, end } = getDateRange();
    const preview = await getExportPreview(start, end);
    setExportPreview(preview);
  }, [exportDateRange]);

  useEffect(() => {
    if (showExportModal) {
      loadExportPreview();
    }
  }, [showExportModal, exportDateRange]);

  const handleExport = async () => {
    if (exportPreview.totalTrips === 0) {
      Alert.alert(
        'No Trips Found',
        'There are no mileage trips in the selected date range. Start tracking a trip first, then export your log.',
      );
      return;
    }

    setIsExporting(true);
    try {
      const { start, end } = getDateRange();
      const options = { format: exportFormat, startDate: start, endDate: end };
      const userName = taxProfile?.fullName || undefined;
      const userAddress = taxProfile?.address
        ? [taxProfile.address, taxProfile.city, taxProfile.state, taxProfile.zip].filter(Boolean).join(', ')
        : undefined;

      const result = exportFormat === 'pdf'
        ? await exportMileagePDF(options, userName, userAddress)
        : await exportMileageCSV(options, userName);

      await shareMileageExport(result, exportFormat);
      setShowExportModal(false);
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error.message || 'Failed to export mileage log.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditPurpose = (trip: Trip) => {
    setEditingTrip(trip);
    setShowPurposeModal(true);
  };

  const handleSelectPurpose = async (purpose: string) => {
    if (!editingTrip) return;
    try {
      await updateTrip(editingTrip.id, { businessPurpose: purpose });
      setShowPurposeModal(false);
      setEditingTrip(null);
      await loadTrips();
    } catch (error) {
      console.error('Error updating purpose:', error);
      Alert.alert('Error', 'Failed to update business purpose.');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Invalid Date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={[styles.tripCard, { backgroundColor: colors.surface }]}
      onPress={() => handleEditPurpose(item)}
      activeOpacity={0.7}>
      <View style={styles.tripHeader}>
        <Text style={[styles.tripDate, { color: colors.text }]}>{formatDate(item.date)}</Text>
        <Text style={[styles.tripMiles, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>
          {(item.miles || 0).toFixed(1)} mi
        </Text>
      </View>
      <View style={styles.tripDetails}>
        <Text style={[styles.tripTime, { color: colors.textSecondary }]}>
          {item.startTime || 'N/A'} - {item.endTime || 'N/A'}
        </Text>
        <Text style={[styles.tripDuration, { color: colors.textSecondary, fontVariant: ['tabular-nums'] }]}>
          {item.duration || 'N/A'}
        </Text>
      </View>
      {item.businessPurpose && (
        <Text style={[styles.tripPurpose, { color: colors.textSecondary }]}>
          {item.businessPurpose}
        </Text>
      )}
    </TouchableOpacity>
  );

  const year = new Date().getFullYear();
  const irsRate = getIRSMileageRate(year);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Mileage Tracker</Text>
        </View>

        <View style={styles.trackerContainer}>
          <MileageTracker onTripSaved={loadTrips} />
        </View>

        {isLoading ? (
          <DashboardSkeleton />
        ) : trips.length === 0 ? (
          <MileageEmpty />
        ) : (
          <View style={styles.tripsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Trips</Text>
            {trips.slice(0, 5).map((item, index) => (
              <FadeInView key={item.id} delay={index * 60}>
                {index > 0 && <View style={styles.separator} />}
                {renderTripItem({ item })}
              </FadeInView>
            ))}
          </View>
        )}

        {/* Export Mileage Log Card */}
        <View style={[styles.exportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.exportCardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
              <Feather name="download" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.exportCardTitle, { color: colors.text }]}>Export Mileage Log</Text>
              <Text style={[styles.exportCardSubtext, { color: colors.textSecondary }]}>
                IRS-compliant PDF or CSV for tax deductions
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => setShowExportModal(true)}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#C6FF5E', '#A8D94E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.exportButtonGradient}>
              <Feather name="file-text" size={18} color="#FFF" />
              <Text style={styles.exportButtonText}>Generate Log</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.background + 'E6' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Export Mileage Log</Text>
              <TouchableOpacity
                onPress={() => setShowExportModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 450 }} contentContainerStyle={{ padding: 24, paddingTop: 0 }}>
              {/* Date Range */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DATE RANGE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {([
                  { key: 'this_year', label: `${year}` },
                  { key: 'last_year', label: `${year - 1}` },
                  { key: 'this_quarter', label: 'This Quarter' },
                ] as const).map((opt) => {
                  const selected = exportDateRange === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setExportDateRange(opt.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary + '20' : 'transparent',
                        alignItems: 'center',
                      }}>
                      <Text style={{
                        color: selected ? colors.primary : colors.textSecondary,
                        fontSize: 13,
                        fontWeight: selected ? '700' : '500',
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Format */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FORMAT</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {([
                  { key: 'pdf' as const, label: 'PDF', icon: 'file-text' as const },
                  { key: 'csv' as const, label: 'CSV', icon: 'file' as const },
                ]).map((opt) => {
                  const selected = exportFormat === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setExportFormat(opt.key)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 12,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary + '20' : 'transparent',
                      }}>
                      <Feather name={opt.icon} size={16} color={selected ? colors.primary : colors.textSecondary} />
                      <Text style={{
                        color: selected ? colors.primary : colors.textSecondary,
                        fontSize: 14,
                        fontWeight: selected ? '700' : '500',
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Preview Stats */}
              <View style={[styles.previewStats, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Total Trips</Text>
                  <Text style={[styles.previewValue, { color: colors.text }]}>{exportPreview.totalTrips}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Total Miles</Text>
                  <Text style={[styles.previewValue, { color: colors.text }]}>{exportPreview.totalMiles.toFixed(1)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Driving Hours</Text>
                  <Text style={[styles.previewValue, { color: colors.text }]}>{exportPreview.totalHours.toFixed(1)}</Text>
                </View>
                <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                    Est. Deduction (${irsRate.toFixed(2)}/mi)
                  </Text>
                  <Text style={[styles.previewValue, { color: colors.primary, fontWeight: '800' }]}>
                    ${exportPreview.deduction.toFixed(2)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.modalButtonRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowExportModal(false)}
                disabled={isExporting}>
                <Text style={[{ color: colors.text, fontSize: 16, fontWeight: '600' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalExportBtn, isExporting && { opacity: 0.5 }]}
                onPress={handleExport}
                disabled={isExporting}>
                <LinearGradient
                  colors={isExporting ? ['#333', '#333'] : ['#C6FF5E', '#A8D94E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalExportGradient}>
                  {isExporting ? (
                    <>
                      <ActivityIndicator color="#FFF" size="small" />
                      <Text style={styles.modalExportText}>Generating...</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="download" size={18} color="#FFF" />
                      <Text style={styles.modalExportText}>
                        Export {exportFormat.toUpperCase()}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Business Purpose Edit Modal */}
      <Modal
        visible={showPurposeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPurposeModal(false)}>
        <View style={[styles.purposeModalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.purposeModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.purposeModalTitle, { color: colors.text }]}>Business Purpose</Text>
            <Text style={[styles.purposeModalSubtext, { color: colors.textSecondary }]}>
              Required for IRS mileage deduction
            </Text>
            <View style={{ gap: 8, marginTop: 16 }}>
              {BUSINESS_PURPOSE_OPTIONS.map((purpose) => {
                const isSelected = editingTrip?.businessPurpose === purpose;
                return (
                  <TouchableOpacity
                    key={purpose}
                    style={[
                      styles.purposeOption,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary + '15' : colors.background,
                      },
                    ]}
                    onPress={() => handleSelectPurpose(purpose)}>
                    <Text style={{ color: isSelected ? colors.primary : colors.text, fontSize: 15, fontWeight: isSelected ? '600' : '400' }}>
                      {purpose}
                    </Text>
                    {isSelected && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.purposeCancelBtn, { borderColor: colors.border }]}
              onPress={() => {
                setShowPurposeModal(false);
                setEditingTrip(null);
              }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold' },
  trackerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400, marginBottom: 30 },
  tripsSection: { marginTop: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  tripCard: { borderRadius: 12, padding: 16 },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tripDate: { fontSize: 16, fontWeight: '600' },
  tripMiles: { fontSize: 18, fontWeight: 'bold' },
  tripDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripTime: { fontSize: 14, fontWeight: '400' },
  tripDuration: { fontSize: 14, fontWeight: '400' },
  tripPurpose: { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  separator: { height: 12 },

  // Export Card
  exportCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportCardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  exportCardSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  exportButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  exportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 8 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#666', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  previewStats: { borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  previewLabel: { fontSize: 14 },
  previewValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  modalButtonRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  modalCancelBtn: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1 },
  modalExportBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalExportGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  modalExportText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Purpose Modal
  purposeModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  purposeModalContent: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 },
  purposeModalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  purposeModalSubtext: { fontSize: 13 },
  purposeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  purposeCancelBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

});
