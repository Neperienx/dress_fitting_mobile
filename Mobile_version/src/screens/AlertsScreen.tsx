import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

type AlertSeverity = 'urgent' | 'warning' | 'pending';

type AlertCategory = 'urgent' | 'other';

type AlertItem = {
  id: string;
  title: string;
  description: string;
  details: string;
  category: AlertCategory;
  severity: AlertSeverity;
  ctaText: string;
};

const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 'missing-tags',
    title: 'Missing Neckline Tags',
    description: '12 dresses missing neckline tags',
    details:
      'These styles were added without neckline metadata. Tag them now so stylists can filter by neckline during appointments.',
    category: 'urgent',
    severity: 'urgent',
    ctaText: 'Review inventory'
  },
  {
    id: 'low-photos',
    title: 'Low Res Photos',
    description: '8 dresses have low resolution photos',
    details:
      'These listings are below the quality threshold used on client-facing views. Upload higher quality photos to improve dress detail previews.',
    category: 'urgent',
    severity: 'warning',
    ctaText: 'Fix stock images'
  },
  {
    id: 'pending-invite',
    title: 'Pending Team Invite',
    description: "Kristin N. (Stylist) hasn't accepted invite",
    details:
      'The invitation has been pending for 5 days. You can resend the invite link or revoke it and invite a different email.',
    category: 'other',
    severity: 'pending',
    ctaText: 'Manage invite'
  }
];

function severitySymbol(severity: AlertSeverity) {
  if (severity === 'urgent') return '❗';
  if (severity === 'warning') return '⚠️';
  return '⏳';
}

export default function AlertsScreen() {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [activeAlert, setActiveAlert] = useState<AlertItem | null>(null);

  const summary = useMemo(
    () => ({
      missingTags: alerts.filter((alert) => alert.id === 'missing-tags').length > 0 ? 12 : 0,
      missingPhotos: alerts.filter((alert) => alert.id === 'low-photos').length > 0 ? 8 : 0,
      pendingInvite: alerts.filter((alert) => alert.id === 'pending-invite').length > 0 ? 1 : 0
    }),
    [alerts]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Alerts (${alerts.length})` });
  }, [alerts.length, navigation]);

  const urgentAlerts = alerts.filter((alert) => alert.category === 'urgent');
  const otherAlerts = alerts.filter((alert) => alert.category === 'other');

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((item) => item.id !== alertId));
    setActiveAlert(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.missingTags}</Text>
            <Text style={styles.summaryLabel}>Missing Tags</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.missingPhotos}</Text>
            <Text style={styles.summaryLabel}>Missing Photos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.pendingInvite}</Text>
            <Text style={styles.summaryLabel}>Pending Invite</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Urgent Alerts</Text>
        {urgentAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No urgent alerts. Great job!</Text>
          </View>
        ) : (
          urgentAlerts.map((alert) => (
            <Pressable key={alert.id} style={styles.alertCard} onPress={() => setActiveAlert(alert)}>
              <Text style={styles.alertTitle}>
                {severitySymbol(alert.severity)} {alert.title}
              </Text>
              <Text style={styles.alertDescription}>{alert.description}</Text>
              <Text style={styles.alertLink}>{alert.ctaText}</Text>
            </Pressable>
          ))
        )}

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Other</Text>
        </View>
        {otherAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending invite tasks.</Text>
          </View>
        ) : (
          otherAlerts.map((alert) => (
            <Pressable key={alert.id} style={styles.alertCard} onPress={() => setActiveAlert(alert)}>
              <View style={styles.otherHeaderRow}>
                <Text style={styles.alertTitle}>
                  {severitySymbol(alert.severity)} {alert.title}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.alertDescription}>{alert.description}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        transparent
        visible={activeAlert !== null}
        animationType="slide"
        onRequestClose={() => setActiveAlert(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveAlert(null)}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{activeAlert?.title}</Text>
            <Text style={styles.modalDescription}>{activeAlert?.details}</Text>
            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalGhostButton} onPress={() => setActiveAlert(null)}>
                <Text style={styles.modalGhostButtonText}>Not now</Text>
              </Pressable>
              {activeAlert && (
                <Pressable style={styles.modalPrimaryButton} onPress={() => dismissAlert(activeAlert.id)}>
                  <Text style={styles.modalPrimaryButtonText}>{activeAlert.ctaText}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f3f8'
  },
  content: {
    padding: 16,
    gap: 12
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5f5b6d'
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ebe8f4',
    alignItems: 'center'
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#242036'
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#6f6a84',
    textAlign: 'center'
  },
  sectionTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#2d2840'
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ebe8f4',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8
  },
  alertTitle: {
    color: '#333042',
    fontWeight: '700',
    fontSize: 15
  },
  alertDescription: {
    marginTop: 4,
    color: '#5f5a70',
    fontSize: 13
  },
  alertLink: {
    marginTop: 2,
    color: '#4f4a66',
    fontSize: 13
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  otherHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chevron: {
    color: '#87839a',
    fontSize: 20,
    lineHeight: 20
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebe8f4',
    padding: 14,
    marginTop: 8
  },
  emptyText: {
    color: '#6f6a84'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 22, 41, 0.45)'
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#e7e3f2'
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d9d4ea',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#29243d'
  },
  modalDescription: {
    marginTop: 10,
    color: '#5f5a70',
    fontSize: 15,
    lineHeight: 22
  },
  modalButtonRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10
  },
  modalGhostButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d7d2e8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalGhostButtonText: {
    color: '#4d4863',
    fontWeight: '600'
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: '#2f2a43',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  }
});
