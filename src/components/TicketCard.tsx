import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ticketQrValue, type SavedTicket } from '@/lib/tickets';
import { islandClock, islandDay, roatanInstant } from '@/lib/cruise';
import { radius, space, type, useTheme } from '@/theme';

/** The ticket the guest shows the guide: QR, big code, meeting point, ship deadline. Works offline. */
export function TicketCard({ ticket }: { ticket: SavedTicket }) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const start = roatanInstant(ticket.date, ticket.time);
  return (
    <View style={[styles.card, { borderColor: c.line, backgroundColor: c.bg }]}>
      <View style={styles.head}>
        <Text style={[type.label, { color: c.flame }]}>{t('ticketH')}</Text>
        <Text style={[type.label, { color: '#16A34A' }]}>✓ {t('worksOffline')}</Text>
      </View>
      <Text style={[type.h2, { color: c.ink }]}>{ticket.title}</Text>
      <Text style={[type.small, { color: c.muted }]}>
        {islandDay(start, i18n.language)} · {islandClock(start, i18n.language)} · {ticket.quantity} {t('u_person').toLowerCase()}
      </Text>
      <View style={styles.qrWrap}>
        <View style={styles.qrBg}>
          <QRCode value={ticketQrValue(ticket.ticketCode)} size={180} backgroundColor="#fff" color="#000" />
        </View>
        <Text style={[styles.code, { color: c.ink }]} selectable>
          {ticket.ticketCode}
        </Text>
        <Text style={[type.small, { color: c.muted, textAlign: 'center' }]}>{t('showGuide')}</Text>
      </View>
      <View style={[styles.meet, { backgroundColor: c.tile }]}>
        <Text style={[type.bodyStrong, { color: c.ink }]}>📍 {t('meetH')}</Text>
        <Text style={[type.small, { color: c.ink }]}>{ticket.meetText}</Text>
        {ticket.contactName ? (
          <Text style={[type.small, { color: c.muted }]}>
            {t('waH')}: {ticket.contactName}
            {ticket.whatsapp ? ` · ${ticket.whatsapp}` : ''}
          </Text>
        ) : null}
      </View>
      {ticket.vanPickupAt ? (
        <View style={[styles.meet, { backgroundColor: c.tile }]}>
          <Text style={[type.bodyStrong, { color: c.ink }]}>🚐 {t('vanH')}</Text>
          <Text style={[type.small, { color: c.ink }]}>
            {t('vanThere').replace('{t}', islandClock(new Date(ticket.vanPickupAt), i18n.language))}
          </Text>
          {ticket.vanReturnAt ? (
            <Text style={[type.small, { color: c.ink }]}>
              {t('vanBack').replace('{t}', islandClock(new Date(ticket.vanReturnAt), i18n.language))}
            </Text>
          ) : null}
        </View>
      ) : null}
      {ticket.allAboardAt ? (
        <Text style={[type.small, { color: c.ink, fontWeight: '700' }]}>
          🚢 {ticket.shipName} · {t('allAboardAt').replace('{t}', islandClock(new Date(ticket.allAboardAt), i18n.language))}
          {ticket.backAtPortBy ? ` · ${t('backAtPortBy').replace('{t}', islandClock(new Date(ticket.backAtPortBy), i18n.language))}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space(4), gap: space(2) },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  qrWrap: { alignItems: 'center', gap: space(2), paddingVertical: space(2) },
  qrBg: { backgroundColor: '#fff', padding: 12, borderRadius: radius.md },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  meet: { borderRadius: radius.md, padding: space(3), gap: 4 },
});
