import { useState } from 'react';

export function useNow(): Date {
  const [now] = useState(() => new Date());
  return now;
}
