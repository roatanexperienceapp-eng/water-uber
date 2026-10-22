import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TicketCard } from '@/components/TicketCard';
import { GettingThereCard } from '@/components/GettingThereCard';
import { useMyShip } from '@/lib/cruise';
import { ticketTrip } from '@/lib/gettingThere';
import { Note } from '@/components/ui';
import { savedTicket } from '@/lib/tickets';
import { space, type, useTheme } from '@/theme';

/** Opens a saved ticket from the phone's storage only — works in airplane mode. */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const c = useTheme();
  const ticket = savedTicket(id);
  const ship = useMyShip();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('backLbl')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/trips'))} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tile }}>
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        {ticket ? <TicketCard ticket={ticket} /> : <Note>{t('ticketMissing')}</Note>}
        {ticket && <GettingThereCard {...ticketTrip(ticket, ship && ship.date === ticket.date ? ship : null)} />}
        <Text style={[type.small, { color: c.muted, textAlign: 'center' }]}>{t('ticketTip')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
