import { useColorScheme } from 'react-native';
import { palette, type Colors } from './tokens';

// Scheme-aware color set. Components read colors through this hook so light/dark
// switches automatically with the OS appearance.
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
