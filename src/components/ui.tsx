import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, type, useTheme } from '@/theme';

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export function Button(props: {
  label: string;
  onPress: () => void;
  trailing?: string;
  variant?: 'brand' | 'ink' | 'tile' | 'sos';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useTheme();
  const v = props.variant ?? 'brand';
  const bg = { brand: c.flame, ink: c.ink, tile: c.tile, sos: c.sos }[v];
  const fg = v === 'tile' ? c.ink : v === 'ink' ? c.onInk : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled || props.loading}
      onPress={() => {
        tap();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        props.small && styles.btnSmall,
        { backgroundColor: bg, opacity: props.disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        props.style,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[props.small ? type.label : type.bodyStrong, { color: fg, fontSize: props.small ? 14 : 17 }]}>{props.label}</Text>
          {props.trailing ? <Text style={[type.h2, { color: fg }]}>{props.trailing}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const c = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: c.tile }]}>
      {props.options.map((o) => {
        const on = o.value === props.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              props.onChange(o.value);
            }}
            style={[styles.segBtn, on && { backgroundColor: c.bg, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}
          >
            <Text style={[type.label, { fontSize: 15, color: on ? c.ink : c.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper(props: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const c = useTheme();
  const btn = (txt: string, delta: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        tap();
        props.onChange(Math.min(props.max, Math.max(props.min, props.value + delta)));
      }}
      style={[styles.stepBtn, { backgroundColor: c.tile }]}
    >
      <Text style={[type.h2, { color: c.ink }]}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[type.bodyStrong, { color: c.ink }]}>{props.label}</Text>
      <View style={[styles.row, { gap: space(4) }]}>
        {btn('−', -1, `Fewer ${props.label}`)}
        <Text style={[type.h2, { color: c.ink, minWidth: 22, textAlign: 'center' }]}>{props.value}</Text>
        {btn('+', 1, `More ${props.label}`)}
      </View>
    </View>
  );
}

export function Card(props: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.tile, borderRadius: radius.lg, padding: space(4), gap: space(2) }, props.style]}>{props.children}</View>;
}

export function Note(props: { children: ReactNode; center?: boolean }) {
  const c = useTheme();
  return <Text style={[type.small, { color: c.muted, textAlign: props.center ? 'center' : 'left' }]}>{props.children}</Text>;
}

const styles = StyleSheet.create({
  btn: { minHeight: 54, borderRadius: radius.md, paddingHorizontal: space(5), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btnSmall: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: space(4), justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
