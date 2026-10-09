import { useState } from 'react';
import { todayLocalISO } from '@/utils/format';

/** First day of the current month, local time (yyyy-MM-dd). */
export const monthStartISO = () => `${todayLocalISO().slice(0, 8)}01`;

/**
 * A from/to day filter for list screens. It defaults to this month, so a
 * screen loads one month instead of all history; clearing it goes back to
 * this month.
 */
export function useDateRange() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayLocalISO());
  const isDefault = from === monthStartISO() && to === todayLocalISO();
  return { from, to, setFrom, setTo, isDefault, reset: () => { setFrom(monthStartISO()); setTo(todayLocalISO()); } };
}
