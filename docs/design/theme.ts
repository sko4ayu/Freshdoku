// Generated from tokens.json. Do not edit by hand.
// React Native theme: the app's equivalent of the Tailwind mapping.
// Components read from `theme`, never from raw hex or pixel values.

export const theme = {
  color: {
    "bg": "#f4f5f7",
    "surface": "#ffffff",
    "surface-muted": "#eceef2",
    "border": "#d9dde3",
    "border-input": "#7c8591",
    "board-frame": "#c9ced6",
    "text": "#1f2430",
    "text-muted": "#586172",
    "accent": "#3d4a5c",
    "on-accent": "#ffffff",
    "danger": "#b3261e",
    "success": "#1f7a4d",
    "warning": "#8a5a00",
    "mark": "#1f2430",
    "life": "#b3261e",
    "life-lost": "#7c8591",
    "piece-pending": "#7c8591",
    "region-1": "#f28b82",
    "region-2": "#f9e076",
    "region-3": "#a8dc8c",
    "region-4": "#5fc9b0",
    "region-5": "#8fb4f5",
    "region-6": "#b89af0",
    "region-7": "#f7a8d0",
    "region-8": "#d2b48c",
    "region-9": "#c9ced6",
    "region-10": "#d4e157",
    "region-11": "#7fd3f2",
    "region-12": "#ffb066"
  },
  overlay: {
    "cell-dim": "rgba(31,36,48,0.38)",
    "scrim": "rgba(31,36,48,0.55)",
    "cell-line": "rgba(31,36,48,0.12)",
    "cell-press": "rgba(255,255,255,0.28)"
  },
  font: { sans: 'Nunito', arabic: 'Cairo' },
  type: {
    "xs": {
      "size": 12,
      "line": 16,
      "weight": 600
    },
    "sm": {
      "size": 14,
      "line": 20,
      "weight": 500
    },
    "base": {
      "size": 16,
      "line": 24,
      "weight": 500
    },
    "lg": {
      "size": 20,
      "line": 28,
      "weight": 700
    },
    "xl": {
      "size": 28,
      "line": 34,
      "weight": 800
    },
    "display": {
      "size": 40,
      "line": 44,
      "weight": 800
    }
  },
  space: [0,4,8,12,16,24,32,48],
  radius: {"cell":4,"sm":8,"md":12,"lg":16,"pill":999},
  border: {"hairline":1,"region":2,"focus":2,"active-card":2,"outline":3},
  size: {"touch-min":44,"icon-button":40,"screen-padding":16,"board-frame":6,"board-padding":5,"cell-gap":5,"header-height":64,"content-max":500,"button":48,"dot":20,"focus-offset":2,"kind":26},
  scale: {"piece":0.8,"mark":0.5,"auto-mark":0.3,"pressed":0.96,"piece-pad":0.07,"lost":0.6,"unlit":0.4,"cell-pressed":0.9},
  motion: {"fast":120,"base":200,"celebrate":600,"ease":"cubic-bezier(.2,.8,.2,1)","screen":220,"spring":"cubic-bezier(.3,1.5,.5,1)"},
} as const;

export const regionColors = [theme.color['region-1'], theme.color['region-2'], theme.color['region-3'], theme.color['region-4'], theme.color['region-5'], theme.color['region-6'], theme.color['region-7'], theme.color['region-8'], theme.color['region-9'], theme.color['region-10'], theme.color['region-11'], theme.color['region-12']] as const;

export type Theme = typeof theme;
