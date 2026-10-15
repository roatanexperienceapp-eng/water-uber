import { StyleSheet, Text, View } from 'react-native';
import type { LiveMapProps } from './LiveMap.types';

/** react-native-maps has no web build. The web target is only for quick previews and tests. */
export default function LiveMap(p: LiveMapProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.box]}>
      <Text style={styles.big}>🗺️</Text>
      <Text style={styles.txt}>Live map runs on iOS and Android.</Text>
      <Text style={styles.small}>{p.boats.length} boats · {p.diveSites.length} dive sites</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#11618A', alignItems: 'center', justifyContent: 'center', gap: 6 },
  big: { fontSize: 36 },
  txt: { color: '#fff', fontWeight: '700' },
  small: { color: 'rgba(255,255,255,0.8)' },
});
