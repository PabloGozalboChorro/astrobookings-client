import { useLocation } from 'react-router';

export function useCurrentPath(): string {
  const { pathname, search } = useLocation();
  return `${pathname}${search}`;
}
