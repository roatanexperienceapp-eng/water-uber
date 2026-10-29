import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useService, type Service } from '@/lib/service';
import { radius, space, type, useTheme } from '@/theme';

/** "Water taxi ▾" at the top of the Ride tab: switch between boats and cars. */
export function ServiceSwitch() {
  const { t } = useTranslation();
  const c = useTheme();
  const [service, setService] = useService();
  const [open, setOpen] = useState(false);
  const label = (s: Service) => t(s === 'water' ? 'svcWater' : 'svcLand');
  const pick = (s: Service) => {
    setService(s);
    setOpen(false);
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('svcSwitch')} onPress={() => setOpen(true)} style={styles.btn}>
        <View style={[styles.logo, { backgroundColor: c.flame }]}>
          <Ionicons name={service === 'water' ? 'boat' : 'car'} size={14} color="#fff" />
        </View>
        <Text style={[type.h2, { color: c.ink }]}>{label(service)}</Text>
        <Ionicons name="chevron-down" size={20} color={c.ink} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: c.bg }]}>
            {(['water', 'land'] as const).map((s) => {
              const on = s === service;
              return (
                <Pressable key={s} accessibilityRole="menuitem" accessibilityState={{ selected: on }} onPress={() => pick(s)} style={[styles.item, on && { backgroundColor: c.tile }]}>
                  <View style={[styles.icon, { backgroundColor: on ? c.flame : c.tile }]}>
                    <Ionicons name={s === 'water' ? 'boat' : 'car'} size={20} color={on ? '#fff' : c.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: c.ink }]}>{label(s)}</Text>
                    <Text style={[type.small, { color: c.muted }]}>{t(s === 'water' ? 'svcWaterSub' : 'svcLandSub')}</Text>
                  </View>
                  {on && <Ionicons name="checkmark" size={20} color={c.flame} />}
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
  btn: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: 4 },
  logo: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', paddingTop: 90, paddingHorizontal: space(4) },
  menu: { borderRadius: radius.lg, padding: space(2), gap: 2, maxWidth: 420 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
