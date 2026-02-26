/**
 * WizardProgressBar — Shows 6 section dots with connecting lines.
 * Tappable to jump to completed sections.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { WIZARD_SECTIONS } from '@/lib/wizardSections';
import { TaxReturnState } from '@/lib/unifiedTaxEngine';

interface Props {
  currentSection: number;
  data: TaxReturnState;
  onSectionPress: (sectionId: number) => void;
}

export default function WizardProgressBar({ currentSection, data, onSectionPress }: Props) {
  const { colors } = useRobinhoodTheme();

  const getStatus = (section: typeof WIZARD_SECTIONS[number]): 'completed' | 'current' | 'upcoming' => {
    if (section.id < currentSection) return 'completed';
    if (section.id === currentSection) return 'current';
    return 'upcoming';
  };

  const percentage = Math.round(((currentSection) / WIZARD_SECTIONS.length) * 100);

  return (
    <View style={styles.container}>
      <Text style={[styles.stepText, { color: colors.textSecondary }]}>
        Section {currentSection + 1} of {WIZARD_SECTIONS.length} · {percentage}%
      </Text>

      <View style={styles.dotsRow}>
        {WIZARD_SECTIONS.map((section, index) => {
          const status = getStatus(section);
          const isLast = index === WIZARD_SECTIONS.length - 1;

          const dotBg =
            status === 'completed' ? colors.primary :
            status === 'current' ? 'transparent' :
            'transparent';

          const dotBorder =
            status === 'completed' ? colors.primary :
            status === 'current' ? colors.primary :
            colors.border;

          const iconColor =
            status === 'completed' ? colors.background :
            status === 'current' ? colors.primary :
            colors.textSecondary;

          const labelColor =
            status === 'current' ? colors.text :
            status === 'completed' ? colors.primary :
            colors.textSecondary;

          const canTap = status === 'completed' || status === 'current';

          return (
            <React.Fragment key={section.id}>
              <TouchableOpacity
                style={styles.dotWrapper}
                onPress={() => canTap && onSectionPress(section.id)}
                disabled={!canTap}
                activeOpacity={canTap ? 0.6 : 1}
              >
                <View style={[
                  styles.dot,
                  { backgroundColor: dotBg, borderColor: dotBorder },
                ]}>
                  {status === 'completed' ? (
                    <Feather name="check" size={14} color={iconColor} />
                  ) : (
                    <Feather name={section.icon as any} size={14} color={iconColor} />
                  )}
                </View>
                <Text style={[styles.dotLabel, { color: labelColor }]} numberOfLines={1}>
                  {section.title}
                </Text>
              </TouchableOpacity>

              {!isLast && (
                <View style={[
                  styles.connector,
                  {
                    backgroundColor: index < currentSection ? colors.primary : colors.border,
                  },
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dotWrapper: {
    alignItems: 'center',
    width: 50,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  connector: {
    height: 2,
    flex: 1,
    marginTop: 15, // center on dot
    borderRadius: 1,
  },
});
