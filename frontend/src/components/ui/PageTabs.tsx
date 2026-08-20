import { useState, useRef, useEffect, createElement } from 'react'
import { useUIStore } from '../../stores/useUIStore'

// ─── Compact SVG icon definitions ──────────────────────────────────────
// Each entry maps icon name → array of [tagName, {attr:value}]
type _N = readonly [string, Record<string, string>]

const I: Record<string, _N[]> = {
  /* ── Default ── */
  layout: [
    ['rect', { x: '3', y: '3', width: '7', height: '7' }],
    ['rect', { x: '14', y: '3', width: '7', height: '7' }],
    ['rect', { x: '14', y: '14', width: '7', height: '7' }],
    ['rect', { x: '3', y: '14', width: '7', height: '7' }],
  ],
  robot: [
    ['rect', { x: '3', y: '6', width: '18', height: '14', rx: '3' }],
    ['circle', { cx: '9', cy: '12', r: '2' }],
    ['circle', { cx: '15', cy: '12', r: '2' }],
    ['line', { x1: '12', y1: '16', x2: '12', y2: '18' }],
    ['line', { x1: '8', y1: '18', x2: '16', y2: '18' }],
    ['line', { x1: '12', y1: '2', x2: '12', y2: '6' }],
    ['line', { x1: '8', y1: '3', x2: '16', y2: '3' }],
  ],
  /* ── People ── */
  users: [
    ['path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
    ['path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
  ],
  heart: [
    ['path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' }],
  ],
  /* ── Charts & Data ── */
  chart: [
    ['line', { x1: '18', y1: '20', x2: '18', y2: '10' }],
    ['line', { x1: '12', y1: '20', x2: '12', y2: '4' }],
    ['line', { x1: '6', y1: '20', x2: '6', y2: '14' }],
  ],
  pie: [
    ['path', { d: 'M21.21 15.89A10 10 0 1 1 8 2.83' }],
    ['path', { d: 'M22 12A10 10 0 0 0 12 2v10z' }],
  ],
  trending: [
    ['polyline', { points: '23 6 13.5 15.5 8.5 10.5 1 18' }],
    ['polyline', { points: '17 6 23 6 23 12' }],
  ],
  /* ── Documents & Lists ── */
  note: [
    ['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }],
    ['polyline', { points: '14 2 14 8 20 8' }],
    ['line', { x1: '16', y1: '13', x2: '8', y2: '13' }],
    ['line', { x1: '16', y1: '17', x2: '8', y2: '17' }],
    ['polyline', { points: '10 9 9 9 8 9' }],
  ],
  list: [
    ['line', { x1: '8', y1: '6', x2: '21', y2: '6' }],
    ['line', { x1: '8', y1: '12', x2: '21', y2: '12' }],
    ['line', { x1: '8', y1: '18', x2: '21', y2: '18' }],
    ['line', { x1: '3', y1: '6', x2: '3.01', y2: '6' }],
    ['line', { x1: '3', y1: '12', x2: '3.01', y2: '12' }],
    ['line', { x1: '3', y1: '18', x2: '3.01', y2: '18' }],
  ],
  clipboard: [
    ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }],
    ['rect', { x: '8', y: '2', width: '8', height: '4', rx: '1', ry: '1' }],
  ],
  book: [
    ['path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }],
    ['path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }],
  ],
  bookmark: [
    ['path', { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }],
  ],
  folder: [
    ['path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }],
  ],
  tag: [
    ['path', { d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z' }],
    ['line', { x1: '7', y1: '7', x2: '7.01', y2: '7' }],
  ],
  /* ── Status & Feedback ── */
  star: [
    ['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26' }],
  ],
  check: [
    ['polyline', { points: '20 6 9 17 4 12' }],
  ],
  bell: [
    ['path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }],
    ['path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }],
  ],
  flag: [
    ['path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }],
    ['line', { x1: '4', y1: '22', x2: '4', y2: '15' }],
  ],
  eye: [
    ['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  /* ── Navigation & Location ── */
  home: [
    ['path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
    ['polyline', { points: '9 22 9 12 15 12 15 22' }],
  ],
  map: [
    ['path', { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' }],
    ['circle', { cx: '12', cy: '10', r: '3' }],
  ],
  compass: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76' }],
  ],
  /* ── Time ── */
  calendar: [
    ['rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }],
    ['line', { x1: '16', y1: '2', x2: '16', y2: '6' }],
    ['line', { x1: '8', y1: '2', x2: '8', y2: '6' }],
    ['line', { x1: '3', y1: '10', x2: '21', y2: '10' }],
  ],
  clock: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['polyline', { points: '12 6 12 12 16 14' }],
  ],
  /* ── Communication ── */
  mail: [
    ['path', { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' }],
    ['polyline', { points: '22,6 12,13 2,6' }],
  ],
  phone: [
    ['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }],
  ],
  chat: [
    ['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }],
  ],
  /* ── Commerce ── */
  cart: [
    ['circle', { cx: '9', cy: '21', r: '1' }],
    ['circle', { cx: '20', cy: '21', r: '1' }],
    ['path', { d: 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6' }],
  ],
  credit: [
    ['rect', { x: '1', y: '4', width: '22', height: '16', rx: '2', ry: '2' }],
    ['line', { x1: '1', y1: '10', x2: '23', y2: '10' }],
  ],
  dollar: [
    ['line', { x1: '12', y1: '1', x2: '12', y2: '23' }],
    ['path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' }],
  ],
  gift: [
    ['polyline', { points: '20 12 20 22 4 22 4 12' }],
    ['rect', { x: '2', y: '7', width: '20', height: '5' }],
    ['line', { x1: '12', y1: '22', x2: '12', y2: '7' }],
    ['path', { d: 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z' }],
    ['path', { d: 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z' }],
  ],
  truck: [
    ['rect', { x: '1', y: '3', width: '15', height: '13' }],
    ['polygon', { points: '16 8 20 8 23 11 23 16 16 16 16 8' }],
    ['circle', { cx: '5.5', cy: '18.5', r: '2.5' }],
    ['circle', { cx: '18.5', cy: '18.5', r: '2.5' }],
  ],
  /* ── Security ── */
  settings: [
    ['circle', { cx: '12', cy: '12', r: '3' }],
    ['path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' }],
  ],
  shield: [
    ['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
  ],
  lock: [
    ['rect', { x: '3', y: '11', width: '18', height: '11', rx: '2', ry: '2' }],
    ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }],
  ],
  /* ── Actions ── */
  edit: [
    ['path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }],
    ['path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' }],
  ],
  trash: [
    ['polyline', { points: '3 6 5 6 21 6' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
  ],
  download: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '7 10 12 15 17 10' }],
    ['line', { x1: '12', y1: '15', x2: '12', y2: '3' }],
  ],
  upload: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '17 8 12 3 7 8' }],
    ['line', { x1: '12', y1: '3', x2: '12', y2: '15' }],
  ],
  refresh: [
    ['polyline', { points: '23 4 23 10 17 10' }],
    ['polyline', { points: '1 20 1 14 7 14' }],
    ['path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' }],
  ],
  share: [
    ['circle', { cx: '18', cy: '5', r: '3' }],
    ['circle', { cx: '6', cy: '12', r: '3' }],
    ['circle', { cx: '18', cy: '19', r: '3' }],
    ['line', { x1: '8.59', y1: '13.51', x2: '15.42', y2: '17.49' }],
    ['line', { x1: '15.41', y1: '6.51', x2: '8.59', y2: '10.49' }],
  ],
  link: [
    ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
  ],
  search: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' }],
  ],
  /* ── Media & Code ── */
  image: [
    ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }],
    ['circle', { cx: '8.5', cy: '8.5', r: '1.5' }],
    ['polyline', { points: '21 15 16 10 5 21' }],
  ],
  video: [
    ['polygon', { points: '5 3 19 12 5 21 5 3' }],
  ],
  camera: [
    ['path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }],
    ['circle', { cx: '12', cy: '13', r: '4' }],
  ],
  code: [
    ['polyline', { points: '16 18 22 12 16 6' }],
    ['polyline', { points: '8 6 2 12 8 18' }],
  ],
  terminal: [
    ['polyline', { points: '4 17 10 11 4 5' }],
    ['line', { x1: '12', y1: '19', x2: '20', y2: '19' }],
  ],
  database: [
    ['ellipse', { cx: '12', cy: '5', rx: '9', ry: '3' }],
    ['path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }],
    ['path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' }],
  ],
  printer: [
    ['polyline', { points: '6 9 6 2 18 2 18 9' }],
    ['path', { d: 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2' }],
    ['rect', { x: '6', y: '14', width: '12', height: '8' }],
  ],
  /* ── Cloud & Internet ── */
  cloud: [
    ['path', { d: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z' }],
  ],
  globe: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '2', y1: '12', x2: '22', y2: '12' }],
    ['path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }],
  ],
  wifi: [
    ['path', { d: 'M5 12.55a11 11 0 0 1 14.08 0' }],
    ['path', { d: 'M1.42 9a16 16 0 0 1 21.16 0' }],
    ['path', { d: 'M8.53 16.11a6 6 0 0 1 6.95 0' }],
    ['line', { x1: '12', y1: '20', x2: '12.01', y2: '20' }],
  ],
  inbox: [
    ['polyline', { points: '22 12 16 12 14 15 10 15 8 12 2 12' }],
    ['path', { d: 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }],
  ],
  /* ── Themes & Environment ── */
  moon: [
    ['path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }],
  ],
  sun: [
    ['circle', { cx: '12', cy: '12', r: '5' }],
    ['line', { x1: '12', y1: '1', x2: '12', y2: '3' }],
    ['line', { x1: '12', y1: '21', x2: '12', y2: '23' }],
    ['line', { x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' }],
    ['line', { x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' }],
    ['line', { x1: '1', y1: '12', x2: '3', y2: '12' }],
    ['line', { x1: '21', y1: '12', x2: '23', y2: '12' }],
    ['line', { x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' }],
    ['line', { x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' }],
  ],
  /* ── Objects ── */
  award: [
    ['circle', { cx: '12', cy: '8', r: '7' }],
    ['polyline', { points: '8.21 13.89 7 23 12 20 17 23 15.79 13.88' }],
  ],
  lightbulb: [
    ['path', { d: 'M9 18h6' }],
    ['path', { d: 'M10 22h4' }],
    ['path', { d: 'M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14' }],
  ],
  coffee: [
    ['path', { d: 'M18 8h1a4 4 0 0 1 0 8h-1' }],
    ['path', { d: 'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z' }],
    ['line', { x1: '6', y1: '1', x2: '6', y2: '4' }],
    ['line', { x1: '10', y1: '1', x2: '10', y2: '4' }],
    ['line', { x1: '14', y1: '1', x2: '14', y2: '4' }],
  ],
  battery: [
    ['rect', { x: '1', y: '6', width: '18', height: '12', rx: '2', ry: '2' }],
    ['line', { x1: '23', y1: '10', x2: '23', y2: '14' }],
    ['line', { x1: '7', y1: '10', x2: '7', y2: '14' }],
    ['line', { x1: '11', y1: '10', x2: '11', y2: '14' }],
    ['line', { x1: '15', y1: '10', x2: '15', y2: '14' }],
  ],
  music: [
    ['path', { d: 'M9 18V5l12-2v13' }],
    ['circle', { cx: '6', cy: '18', r: '3' }],
    ['circle', { cx: '18', cy: '16', r: '3' }],
  ],
  ruler: [
    ['path', { d: 'M16 2v20' }],
    ['path', { d: 'M4 6h12' }],
    ['path', { d: 'M4 12h8' }],
    ['path', { d: 'M4 18h6' }],
    ['rect', { x: '2', y: '2', width: '4', height: '20', rx: '1' }],
  ],
  layers: [
    ['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }],
    ['polyline', { points: '2 17 12 22 22 17' }],
    ['polyline', { points: '2 12 12 17 22 12' }],
  ],
}

function _r(nodes: _N[]) {
  return nodes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))
}

function TabIcon({ icon }: { icon?: string }) {
  // If icon is a known SVG name, render as SVG
  if (icon && I[icon]) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tab-icon">
        {_r(I[icon])}
      </svg>
    )
  }
  // Emoji icon or empty placeholder (don't show text fallback)
  return <span className="tab-icon tab-icon-emoji">{icon || ''}</span>
}

export function PageTabs() {
  const {
    pages, activePageId, editMode, creatingNew,
    setActivePage, toggleEditMode,
    startCreating, createPage, cancelCreating,
    deletePage, renamePage, removeTemporaryPage, reorderPages, fetchPages,
  } = useUIStore()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newPageValue, setNewPageValue] = useState('')

  // Drag-and-drop state (edit mode only)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; side: 'left' | 'right' } | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const renameInputRef = useRef<HTMLInputElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  const fixedPages = pages.filter((p) => p.type === 'fixed')
  const tempPages = pages.filter((p) => p.type === 'temporary')

  // Load pages from backend on mount (restores tabs after restart)
  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  // Auto-focus new-page input
  useEffect(() => {
    if (creatingNew && newInputRef.current) {
      newInputRef.current.focus()
    }
  }, [creatingNew])

  const startRename = (id: string) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setRenamingId(id)
      setRenameValue(page.name)
    }
  }

  const confirmRename = (id: string) => {
    if (renameValue.trim()) {
      renamePage(id, renameValue.trim())
    }
    setRenamingId(null)
  }

  const confirmNewPage = async () => {
    if (newPageValue.trim()) {
      await createPage(newPageValue.trim())
      setNewPageValue('')
    } else {
      cancelCreating()
    }
  }

  // ── Drag-and-drop handlers (edit mode only) ──

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!editMode) return
    dragIdRef.current = id
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    // Delay visual feedback so the drag image captures the non-dragging state
    requestAnimationFrame(() => setDraggedId(id))
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    // Don't show indicator when hovering over self
    if (id === dragIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const side = x < rect.width / 2 ? 'left' : 'right'
    setDropTarget({ id, side })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when actually leaving the wrapper (not entering a child)
    const related = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(related)) {
      setDropTarget(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) {
      setDropTarget(null)
      return
    }
    // Determine insertion point based on side
    if (dropTarget?.side === 'left') {
      reorderPages(sourceId, targetId)
    } else {
      // Insert after targetId → find the next sibling or null (end)
      const idx = fixedPages.findIndex((p) => p.id === targetId)
      const nextPage = fixedPages[idx + 1]
      reorderPages(sourceId, nextPage?.id ?? null)
    }
    setDropTarget(null)
    setDraggedId(null)
    dragIdRef.current = null
  }

  const handleDragEnd = () => {
    setDropTarget(null)
    setDraggedId(null)
    dragIdRef.current = null
  }

  return (
    <div className="page-tabs">
      {/* ── Left: fixed pages ── */}
      <div className="page-tabs-left">
        {/* 涌现 — always first, pinned (no drag, no delete) */}
        {(() => {
          const page = fixedPages.find(p => p.id === 'interact')
          if (!page) return null
          return (
            <div key={page.id} className="page-tab-wrapper">
              <button
                className={`page-tab${activePageId === page.id ? ' active' : ''}${editMode ? ' edit-mode' : ''}`}
                onClick={() => setActivePage(page.id)}
                onDoubleClick={() => editMode && startRename(page.id)}
                title={page.name}
              >
                <TabIcon icon={page.icon} />
                {renamingId === page.id ? (
                  <input
                    ref={renameInputRef}
                    className="tab-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => confirmRename(page.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmRename(page.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="tab-label">{page.name}</span>
                )}
              </button>
            </div>
          )
        })()}

        {/* Divider between pinned page and others (always visible) */}
        <div className="tab-divider" />

        {/* Other fixed pages */}
        {fixedPages.filter(p => p.id !== 'interact').map((page) => (
          <div
            key={page.id}
            className={`page-tab-wrapper${
              draggedId === page.id ? ' dragging' : ''
            }${
              dropTarget?.id === page.id
                ? dropTarget.side === 'left' ? ' drop-before' : ' drop-after'
                : ''
            }`}
            draggable={editMode}
            onDragStart={(e) => handleDragStart(e, page.id)}
            onDragOver={(e) => handleDragOver(e, page.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, page.id)}
            onDragEnd={handleDragEnd}
          >
            <button
              className={
                `page-tab${activePageId === page.id ? ' active' : ''}` +
                (editMode ? ' edit-mode' : '')
              }
              onClick={() => setActivePage(page.id)}
              onDoubleClick={() => editMode && startRename(page.id)}
              title={page.name}
            >
              <TabIcon icon={page.icon} />
              {renamingId === page.id ? (
                <input
                  ref={renameInputRef}
                  className="tab-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => confirmRename(page.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename(page.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-label">{page.name}</span>
              )}
            </button>

            {/* Delete button — only in edit mode */}
            {editMode && (
              <button
                className="tab-delete-btn"
                onClick={() => deletePage(page.id)}
                title="删除页面"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* "+" new-page area — only in edit mode */}
        {editMode && (
          <div className="add-page-area">
            {creatingNew ? (
              <div className="add-page-inline">
                <input
                  ref={newInputRef}
                  className="add-page-input"
                  placeholder="页面名称"
                  value={newPageValue}
                  onChange={(e) => setNewPageValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmNewPage()
                    if (e.key === 'Escape') {
                      cancelCreating()
                      setNewPageValue('')
                    }
                  }}
                  onBlur={confirmNewPage}
                />
              </div>
            ) : (
              <button
                className="add-page-btn"
                onClick={startCreating}
                title="新建固定页面"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Right: temp pages + edit toggle ── */}
      <div className="page-tabs-right">
        {tempPages.length > 0 && <div className="tab-divider" />}

        {tempPages.map((page) => (
          <div key={page.id} className="page-tab-wrapper">
            <button
              className={
                `page-tab temp${activePageId === page.id ? ' active' : ''}`
              }
              onClick={() => setActivePage(page.id)}
              title={page.name}
            >
              <span className="tab-icon temp-icon">⏳</span>
              <span className="tab-label">{page.name}</span>
            </button>
            {editMode && (
              <button
                className="close-btn"
                onClick={(e) => { e.stopPropagation(); removeTemporaryPage(page.id) }}
                title="关闭临时页面"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))}

        <button
          className={`edit-toggle-btn${editMode ? ' active' : ''}`}
          onClick={toggleEditMode}
          title={editMode ? '保存并退出编辑' : '编辑页面'}
        >
          {editMode ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>保存</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>编辑</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
