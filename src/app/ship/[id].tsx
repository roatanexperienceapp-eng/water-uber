import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { setMyShip, shipCall } from '@/lib/cruise';

/** /ship/<ship call id> — a QR on the pier sets the guest's ship and opens Explore in cruise mode. */
export default function ShipLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    shipCall(id)
      .then((call) => call && setMyShip(call))
      .finally(() => setDone(true));
  }, [id]);
  return done ? <Redirect href="/explore" /> : null;
}
