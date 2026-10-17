import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { setMyShip, shipCall } from '@/lib/cruise';

/**
 * Short booking link for QR codes and flyers: /l/<listing id>?ship=<ship call id>
 * Works on the website (no app) and opens the app directly when it's installed (universal links).
 */
export default function ListingLink() {
  const { id, ship } = useLocalSearchParams<{ id: string; ship?: string }>();
  const [ready, setReady] = useState(!ship);
  useEffect(() => {
    if (!ship) return;
    shipCall(ship)
      .then((call) => call && setMyShip(call))
      .finally(() => setReady(true));
  }, [ship]);
  if (!ready) return null;
  return <Redirect href={{ pathname: '/checkout', params: { kind: 'listing', id } }} />;
}
