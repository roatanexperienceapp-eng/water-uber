import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { brand } from '@/theme';
import type { LiveMapProps } from './LiveMap.types';

const KM_PER_MI = 1.609344;
const BOAT_COLOR = { taxi: brand.flame, tour: brand.lagoon, fish: brand.fishing } as const;

function regionFor(center: LiveMapProps['center'], miles: number) {
  const latDelta = (2 * miles * KM_PER_MI) / 110.57;
  const lngDelta = latDelta / Math.cos((center.latitude * Math.PI) / 180);
  return { ...center, latitudeDelta: latDelta * 1.05, longitudeDelta: lngDelta * 1.05 };
}

export default function LiveMap(p: LiveMapProps) {
  const ref = useRef<MapView>(null);
  useEffect(() => {
    ref.current?.animateToRegion(regionFor(p.center, p.rangeMiles), 350);
  }, [p.center.latitude, p.center.longitude, p.rangeMiles]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={regionFor(p.center, p.rangeMiles)}
      mapType={p.satellite ? 'hybrid' : 'standard'}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
      pitchEnabled={false}
    >
      <Circle
        center={p.center}
        radius={p.rangeMiles * KM_PER_MI * 1000}
        strokeColor="rgba(255,255,255,0.8)"
        strokeWidth={1.5}
        lineDashPattern={[6, 6]}
        fillColor="rgba(0,0,0,0)"
      />
      {p.route.length > 1 && (
        <Polyline
          coordinates={p.route.map(([longitude, latitude]) => ({ latitude, longitude }))}
          strokeColor={brand.flame}
          strokeWidth={4}
          lineDashPattern={[10, 8]}
        />
      )}
      {p.docks.map((d) => (
        <Marker key={d.id} coordinate={{ latitude: d.lat, longitude: d.lon }} title={d.name} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dock, d.selected && styles.dockOn]} />
        </Marker>
      ))}
      {p.diveSites.map((s) => (
        <Marker
          key={s.name}
          coordinate={{ latitude: s.lat, longitude: s.lon }}
          onPress={() => p.onDivePress(s)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.flag}>
            <View style={styles.flagStripe} />
          </View>
        </Marker>
      ))}
      {(p.pins ?? []).map((pin) => (
        <Marker key={pin.id} coordinate={{ latitude: pin.lat, longitude: pin.lon }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={pin.kind === 'pickup' ? styles.pinFrom : styles.pinTo} />
        </Marker>
      ))}
      {(p.cars ?? []).map((car) => (
        <Marker key={car.id} coordinate={{ latitude: car.lat, longitude: car.lon }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.car, car.mine && styles.carMine, { opacity: car.available || car.mine ? 1 : 0.55, width: car.kind === 'van' ? 20 : 16 }]} />
        </Marker>
      ))}
      {p.boats.map((b) => (
        <Marker
          key={b.id}
          coordinate={{ latitude: b.lat, longitude: b.lon }}
          onPress={() => p.onBoatPress(b)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.halo, { borderColor: b.available ? BOAT_COLOR[b.kind] : 'transparent' }]}>
            <View style={[styles.boat, { backgroundColor: BOAT_COLOR[b.kind], width: b.seats > 8 ? 16 : 13, height: b.seats > 8 ? 16 : 13 }]} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  dock: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: '#0B4466' },
  dockOn: { backgroundColor: brand.flame, borderColor: '#fff', width: 14, height: 14, borderRadius: 7 },
  flag: { width: 16, height: 11, backgroundColor: '#D62828', borderWidth: 1, borderColor: '#fff', overflow: 'hidden', justifyContent: 'center' },
  flagStripe: { height: 2.5, width: 22, backgroundColor: '#fff', transform: [{ rotate: '34deg' }], marginLeft: -3 },
  halo: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  boat: { borderRadius: 999, borderWidth: 2, borderColor: '#fff' },
  car: { height: 11, borderRadius: 3, backgroundColor: '#0b0b0c', borderWidth: 2, borderColor: '#fff' },
  carMine: { backgroundColor: brand.flame, height: 15, transform: [{ scale: 1.3 }] },
  pinFrom: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#0b0b0c', borderWidth: 3, borderColor: '#fff' },
  pinTo: { width: 16, height: 16, backgroundColor: brand.flame, borderWidth: 3, borderColor: '#fff' },
});
