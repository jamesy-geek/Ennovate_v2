export interface StickerConfig {
  id: string;
  label: string;
  href: string;
  acrossPct: number;
  upPct: number;
  tiltDeg: number;
}

export interface LogoConfig {
  acrossPct: number;
  upPct: number;
}

export const LOGO_CONFIG: LogoConfig = {
  acrossPct: 50,
  upPct: 62,
};

export const LID_NODE_NAME = 'Cube.001';

export const STICKERS: StickerConfig[] = [
  {
    id: 'projects',
    label: 'Projects',
    href: '#projects',
    acrossPct: 20,
    upPct: 76,
    tiltDeg: -8,
  },
  {
    id: 'achievements',
    label: 'Achievements',
    href: '#achievements',
    acrossPct: 80,
    upPct: 74,
    tiltDeg: 6,
  },
  {
    id: 'members',
    label: 'Members',
    href: '#members',
    acrossPct: 81,
    upPct: 35,
    tiltDeg: -5,
  },
  {
    id: 'spare',
    label: 'Spare',
    href: '#spare',
    acrossPct: 19,
    upPct: 35,
    tiltDeg: 9,
  },
];
