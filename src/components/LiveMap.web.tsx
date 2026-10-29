import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COAST } from '@/data/coast';
import { brand } from '@/theme';
import type { LiveMapProps } from './LiveMap.types';

/**
 * Web preview only (react-native-maps has no web build). Draws the island, docks, route, boats and
 * dive sites as SVG with the same projection idea as the native map. Phones use the real map.
 */
const KM_PER_MI = 1.609344;
const BOAT_COLOR = { taxi: brand.flame, tour: brand.lagoon, fish: brand.fishing } as const;

export default function LiveMap(p: LiveMapProps) {
  const ref = useRef<View>(null);
  const [size, setSize] = useState({ w: 360, h: 300 });
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setSize({ w: r.width, h: r.height });
  }, []);

  const { w, h } = size;
  const kx = 111.32 * Math.cos((p.center.latitude * Math.PI) / 180);
  const ky = 110.57;
  const radiusPx = Math.min(w, h) / 2 - 8;
  const s = radiusPx / (p.rangeMiles * KM_PER_MI);
  const P = (lon: number, lat: number): [number, number] => [w / 2 + (lon - p.center.longitude) * kx * s, h / 2 - (lat - p.center.latitude) * ky * s];
  const path = (ring: [number, number][]) => 'M' + ring.map(([lo, la]) => P(lo, la).map((n) => n.toFixed(1)).join(',')).join(' L') + 'Z';
  const big = p.rangeMiles <= 2;

  return (
    <View ref={ref} style={StyleSheet.absoluteFill}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0B4466" />
            <stop offset="1" stopColor="#11618A" />
          </linearGradient>
        </defs>
        <rect width={w} height={h} fill="url(#sea)" />
        {COAST.map((r, i) => (
          <path key={`reef${i}`} d={path(r)} fill="none" stroke="#5FD6CF" strokeOpacity={0.45} strokeWidth={s * 0.5} strokeLinejoin="round" />
        ))}
        {COAST.map((r, i) => (
          <path key={`land${i}`} d={path(r)} fill="#3E6B33" stroke="#EBDDAE" strokeWidth={1.3} />
        ))}
        <circle cx={w / 2} cy={h / 2} r={radiusPx} fill="none" stroke="#fff" strokeOpacity={0.7} strokeDasharray="4 5" />
        {p.route.length > 1 && (
          <polyline
            points={p.route.map(([lo, la]) => P(lo, la).join(',')).join(' ')}
            fill="none"
            stroke={brand.flame}
            strokeWidth={3}
            strokeDasharray="7 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {p.docks.map((d) => {
          const [x, y] = P(d.lon, d.lat);
          return <circle key={d.id} cx={x} cy={y} r={d.selected ? 6 : 4} fill={d.selected ? brand.flame : '#fff'} stroke={d.selected ? '#fff' : '#0B4466'} strokeWidth={2} />;
        })}
        {p.diveSites.map((site) => {
          const [x, y] = P(site.lon, site.lat);
          const fw = big ? 12 : 9;
          const fh = big ? 8 : 6;
          return (
            <g key={site.name} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={() => p.onDivePress(site)}>
              <rect x={-10} y={-10} width={20} height={20} fill="transparent" />
              <rect x={-fw / 2} y={-fh / 2} width={fw} height={fh} fill="#D62828" stroke="#fff" strokeWidth={0.8} />
              <line x1={-fw / 2} y1={-fh / 2} x2={fw / 2} y2={fh / 2} stroke="#fff" strokeWidth={1.6} />
            </g>
          );
        })}
        {(p.pins ?? []).map((pin) => {
          const [x, y] = P(pin.lon, pin.lat);
          return pin.kind === 'pickup' ? (
            <circle key={pin.id} cx={x} cy={y} r={7} fill="#0b0b0c" stroke="#fff" strokeWidth={3} />
          ) : (
            <rect key={pin.id} x={x - 7} y={y - 7} width={14} height={14} fill={brand.flame} stroke="#fff" strokeWidth={3} />
          );
        })}
        {(p.cars ?? []).map((car) => {
          const [x, y] = P(car.lon, car.lat);
          const cw = (car.kind === 'van' ? 20 : 16) * (car.mine ? 1.3 : 1);
          const ch = car.mine ? 14 : 11;
          return (
            <rect key={car.id} x={x - cw / 2} y={y - ch / 2} width={cw} height={ch} rx={3} fill={car.mine ? brand.flame : '#0b0b0c'} stroke="#fff" strokeWidth={2} opacity={car.available || car.mine ? 1 : 0.55} style={{ transition: 'x 1s linear, y 1s linear' }} />
          );
        })}
        {p.boats.map((b) => {
          const [x, y] = P(b.lon, b.lat);
          return (
            <g key={b.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} style={{ cursor: 'pointer', transition: 'transform 1s linear' }} onClick={() => p.onBoatPress(b)}>
              <circle r={13} fill="transparent" />
              {b.available && <circle r={9} fill="none" stroke={BOAT_COLOR[b.kind]} strokeWidth={2} strokeOpacity={0.6} />}
              <circle r={b.seats > 8 ? 6.5 : 5.5} fill={BOAT_COLOR[b.kind]} stroke="#fff" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
    </View>
  );
}
