import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/ui';
import { WEB_URL } from '@/config';
import { getMyShip } from '@/lib/cruise';
import { radius, space, type, useTheme } from '@/theme';

/** Booking link for a listing. Opens the website (no download) or the app if it's installed. */
export function listingUrl(id: string, shipCallId?: string): string {
  return `${WEB_URL}/l/${encodeURIComponent(id)}${shipCallId ? `?ship=${encodeURIComponent(shipCallId)}` : ''}`;
}

/** Small share icon → QR code anyone can scan to book this, no app needed. Good for flyers and friends. */
export function ShareQR({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const url = listingUrl(id, getMyShip()?.id);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('shareQr')} onPress={() => setOpen(true)} style={[styles.icon, { backgroundColor: c.tile }]} hitSlop={6}>
        <Ionicons name="qr-code-outline" size={18} color={c.ink} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.bg }]} onPress={() => {}}>
            <Text style={[type.h2, { color: c.ink, textAlign: 'center' }]}>{name}</Text>
            <Text style={[type.small, { color: c.muted, textAlign: 'center' }]}>{t('scanToBook')}</Text>
            <View style={styles.qr}>
              <QRCode value={url} size={200} backgroundColor="#fff" color="#000" />
            </View>
            <Text style={[type.small, { color: c.muted, textAlign: 'center' }]} selectable>
              {url}
            </Text>
            <Button label={t('shareLink')} trailing="↗" onPress={() => Share.share({ message: `${name} · ${url}` })} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: space(5), paddingBottom: space(10), gap: space(3) },
  qr: { alignSelf: 'center', backgroundColor: '#fff', padding: 14, borderRadius: radius.md },
});
