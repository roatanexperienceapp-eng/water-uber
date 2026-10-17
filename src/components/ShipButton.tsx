import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countdown, islandClock, islandDay, PORTS, roatanDate, setMyShip, shipCalls, useMyShip, type ShipCall } from '@/lib/cruise';
import { radius, space, type, useTheme } from '@/theme';

/**
 * "My ship" — sits next to the language button. Picking today's ship turns on cruise mode everywhere:
 * the all-aboard countdown, "fits your port time" badges, and checkout times that can't miss the ship.
 */
export function ShipButton() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const ship = useMyShip();
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<ShipCall[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (open) shipCalls(roatanDate(new Date()), 2).then(setCalls).catch(() => setCalls([]));
  }, [open]);

  const left = ship ? countdown(ship.allAboardAt, now) : null;
  const urgent = left && left.minutes < 120;
  const label = ship ? (left ? left.text : t('shipSailed')) : t('myShip');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('myShip')}
        onPress={() => setOpen(true)}
        style={[styles.pill, { backgroundColor: ship ? (urgent ? c.sos : c.ink) : c.tile }]}
      >
        <Text style={[type.label, { fontSize: 15, color: ship ? '#fff' : c.ink }]}>🚢 {label}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.bg }]} onPress={() => {}}>
            <Text style={[type.h2, { color: c.ink }]}>{t('pickShip')}</Text>
            <Text style={[type.small, { color: c.muted, marginBottom: space(2) }]}>{t('pickShipSub')}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {calls.length === 0 && <Text style={[type.body, { color: c.muted, paddingVertical: space(3) }]}>{t('noShips')}</Text>}
              {calls.map((call) => {
                const on = ship?.id === call.id;
                return (
                  <Pressable
                    key={call.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      setMyShip(call);
                      setOpen(false);
                    }}
                    style={[styles.item, { backgroundColor: on ? c.tile : 'transparent' }]}
                  >
                    <Text style={{ fontSize: 22 }}>🚢</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.bodyStrong, { color: c.ink }]}>{call.ship}</Text>
                      <Text style={[type.small, { color: c.muted }]}>
                        {islandDay(call.arriveAt, i18n.language)} · {PORTS[call.port].name}
                      </Text>
                      <Text style={[type.small, { color: c.ink }]}>
                        {t('allAboardAt').replace('{t}', islandClock(call.allAboardAt, i18n.language))}
                      </Text>
                    </View>
                    {on && <Text style={[type.bodyStrong, { color: c.flame }]}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
            {ship && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMyShip(null);
                  setOpen(false);
                }}
                style={[styles.item, { justifyContent: 'center' }]}
              >
                <Text style={[type.bodyStrong, { color: c.ink }]}>{t('notCruising')}</Text>
              </Pressable>
            )}
            <Text style={[type.small, { color: c.muted }]}>{t('islandTimeNote')}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(10), gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.sm },
});
