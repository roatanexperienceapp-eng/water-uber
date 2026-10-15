import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n';
import { radius, space, type, useTheme } from '@/theme';

export function LanguageButton() {
  const { i18n, t } = useTranslation();
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('language')} onPress={() => setOpen(true)} style={[styles.pill, { backgroundColor: c.tile }]}>
        <Text style={[type.label, { fontSize: 15, color: c.ink }]}>🌐 {current.short}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: c.bg }]}>
            <Text style={[type.h2, { color: c.ink, marginBottom: space(2) }]}>{t('language')}</Text>
            {LANGUAGES.map((l) => {
              const on = l.code === i18n.language;
              return (
                <Pressable
                  key={l.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    i18n.changeLanguage(l.code);
                    setOpen(false);
                  }}
                  style={[styles.item, on && { backgroundColor: c.tile }]}
                >
                  <Text style={[type.body, { color: c.ink, fontWeight: on ? '700' : '500' }]}>{l.label}</Text>
                  <Text style={[type.small, { color: c.muted }]}>{l.short}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(10), gap: 2 },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: radius.sm },
});
