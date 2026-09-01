import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { Transaction } from './types';

// Subscribe to live INSERTs on this user's transactions (Realtime must be
// enabled on the table — see migration 20260901120002). Fires the callback
// with the mapped new row: this is what makes a card tap show up in the open
// web app within seconds.
export function useLiveTransactions(
  userId: string,
  onInsert: (txn: Transaction) => void
): void {
  const cb = useRef(onInsert);
  cb.current = onInsert;

  useEffect(() => {
    // Unique topic per subscriber — identical topics collide in realtime-js
    // (Shell + a page can both be listening at once).
    const channel = supabase
      .channel(`txn-live-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const r = payload.new as any;
          cb.current({
            id: r.id,
            amount: r.amount,
            currency: r.currency,
            direction: r.direction,
            description: r.description,
            merchant: r.merchant ?? null,
            cardLabel: r.card_label ?? null,
            category: r.category,
            transactionDate: r.transaction_date,
            source: r.source,
            categoryConfidence: r.category_confidence ?? null,
            needsReview: r.needs_review ?? false,
            notes: r.notes ?? null,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
