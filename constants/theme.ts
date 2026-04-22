import { Platform } from 'react-native';

const tintColorLight = '#CAA2EF';
const tintColorDark = '#210F33';

export const Colors = {
  light: {
    text: '#D8C5E8',
    background: '#5C4670',
    tint: tintColorDark,
    icon: '#8B7A9B',
    tabIconDefault: '#8B7A9B',
    tabIconSelected: tintColorDark,
    card: '#4B395C',
    border: '#7A668E',
    error: '#E88B9E',
    primary: tintColorLight,
  },
  dark: {
    text: '#D8C5E8',
    background: '#5C4670',
    tint: tintColorDark,
    icon: '#8B7A9B',
    tabIconDefault: '#8B7A9B',
    tabIconSelected: tintColorDark,
    card: '#4B395C',
    border: '#7A668E',
    error: '#E88B9E',
    primary: tintColorLight,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});