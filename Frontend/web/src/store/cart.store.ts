import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export type CartItemType = 'PRODUCT' | 'EVENT_TICKET' | 'SOUL_TOUR' | 'SERVICE_BOOKING';

export interface CartItem {
  /** Stable local id — we reuse the server item id once sync has happened. */
  id: string;
  itemType: CartItemType;
  itemId: string;
  variantId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  metadata?: Record<string, any>;
  // Display helpers
  category?: string;
  guideName?: string;
  productType?: 'DIGITAL' | 'PHYSICAL';
  variantName?: string;
  // Warnings supplied by the server on sync
  priceAtAdd?: number | null;
  currentPrice?: number | null;
  priceChanged?: boolean;
  overstock?: boolean;
  availableStock?: number | null;
}

export interface CartWarning {
  /** Kind of warning. Renderer decides whether it blocks checkout. */
  kind: 'removed' | 'price_changed' | 'overstock';
  message: string;
}

interface CartState {
  items: CartItem[];
  /** Server-sync state */
  syncing: boolean;
  lastSyncedAt: number | null;
  /** Warnings surfaced from last sync (removed items, price changes, etc.) */
  warnings: CartWarning[];
  /** Seeker has seen + explicitly acknowledged the current warnings. */
  warningsAcknowledged: boolean;

  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: (opts?: { skipServer?: boolean }) => void;
  getSubtotal: () => number;
  getItemCount: () => number;
  hasPhysicalItems: () => boolean;
  hasDigitalItems: () => boolean;
  hasEventItems: () => boolean;
  hasTourItems: () => boolean;

  // Sync API
  syncFromServer: () => Promise<void>;
  mergeGuestCartIntoUser: () => Promise<void>;
  acknowledgeWarnings: () => void;
}

// ───── Feature flag ───────────────────────────────────────────────────────
// When off, the store behaves exactly as before: localStorage-only, no
// server traffic. Flip back to false for instant rollback if anything
// catches fire in production.
const SERVER_CART_ENABLED =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_SERVER_CART_ENABLED !== 'false';

// ───── Write-through debounce ─────────────────────────────────────────────
// Rapid +/- clicks on a quantity input should collapse into one PATCH.
const writeQueues = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 450;

function debounce(key: string, fn: () => void | Promise<void>) {
  const existing = writeQueues.get(key);
  if (existing) clearTimeout(existing);
  writeQueues.set(key, setTimeout(() => {
    writeQueues.delete(key);
    void fn();
  }, DEBOUNCE_MS));
}

// ───── Helpers to translate server responses to local cart items ──────────
function mapServerItem(raw: any): CartItem {
  const details = raw.details ?? {};
  const variant = details.selectedVariant;
  const name =
    raw.itemType === 'PRODUCT'   ? (details?.name ?? 'Product') :
    raw.itemType === 'EVENT_TICKET' ? (details?.event?.title ?? 'Event ticket') :
    raw.itemType === 'SOUL_TOUR' ? (details?.title ?? 'Soul tour') :
    raw.itemType === 'SERVICE_BOOKING' ? (details?.name ?? 'Service') : 'Item';
  const price = Number(raw.currentPrice ?? raw.priceAtAdd ?? 0);
  const imageUrl =
    details?.imageUrls?.[0] ??
    details?.coverImageUrl ??
    details?.event?.coverImageUrl ?? undefined;

  return {
    id: raw.id,
    itemType: raw.itemType as CartItemType,
    itemId: raw.itemId,
    variantId: raw.variantId ?? undefined,
    name,
    price,
    quantity: raw.quantity,
    imageUrl,
    metadata: raw.metadata ?? undefined,
    category: details?.category ?? undefined,
    guideName: details?.guide?.displayName ?? undefined,
    productType: details?.type === 'DIGITAL' || details?.type === 'PHYSICAL'
      ? details.type
      : undefined,
    variantName: variant?.name ?? undefined,
    priceAtAdd: raw.priceAtAdd != null ? Number(raw.priceAtAdd) : null,
    currentPrice: raw.currentPrice != null ? Number(raw.currentPrice) : null,
    priceChanged: !!raw.priceChanged,
    overstock: !!raw.overstock,
    availableStock: raw.availableStock,
  };
}

/** Compute per-item warning messages (includes backend-removed items). */
function buildWarnings(
  items: CartItem[],
  removed: Array<{ name: string; reason: string }>,
): CartWarning[] {
  const out: CartWarning[] = [];
  for (const r of removed) {
    const reasonLabel =
      r.reason === 'deleted'   ? 'was removed from the catalog' :
      r.reason === 'sold_out'  ? 'is sold out' :
                                  'is no longer available';
    out.push({ kind: 'removed', message: `"${r.name}" ${reasonLabel} and was removed from your cart.` });
  }
  for (const item of items) {
    if (item.priceChanged && item.priceAtAdd != null && item.currentPrice != null) {
      const direction = item.currentPrice > item.priceAtAdd ? 'increased' : 'decreased';
      out.push({
        kind: 'price_changed',
        message: `"${item.name}" price ${direction} — $${item.priceAtAdd.toFixed(2)} → $${item.currentPrice.toFixed(2)}.`,
      });
    }
    if (item.overstock && item.availableStock != null) {
      out.push({
        kind: 'overstock',
        message: `Only ${item.availableStock} of "${item.name}" in stock — please lower the quantity.`,
      });
    }
  }
  return out;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      syncing: false,
      lastSyncedAt: null,
      warnings: [],
      warningsAcknowledged: true,

      addItem: (item) => {
        const existingByKey = get().items.find(
          (i) => i.itemType === item.itemType && i.itemId === item.itemId && (i.variantId ?? '') === (item.variantId ?? ''),
        );
        // Optimistic local update — server is authoritative but we never block UX on it.
        if (existingByKey) {
          const newQty = existingByKey.quantity + (item.quantity || 1);
          set((state) => ({
            items: state.items.map((i) => i.id === existingByKey.id ? { ...i, quantity: newQty } : i),
          }));
        } else {
          const tempId = `${item.itemType}-${item.itemId}-${item.variantId || 'default'}`;
          set((state) => ({ items: [...state.items, { ...item, id: tempId }] }));
        }

        if (!SERVER_CART_ENABLED) return;
        // Write-through: queue one add per (type,id,variant) key
        const key = `add:${item.itemType}:${item.itemId}:${item.variantId ?? ''}`;
        debounce(key, async () => {
          try {
            await api.post('/cart/items', {
              itemType: item.itemType,
              itemId: item.itemId,
              variantId: item.variantId,
              quantity: item.quantity ?? 1,
              metadata: item.metadata,
            });
            // After add we resync so the row gets the real server id + warnings
            void get().syncFromServer();
          } catch {
            // Silent — item is still in local cart; next mutation or page load reconciles.
          }
        });
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        }));

        if (!SERVER_CART_ENABLED) return;
        debounce(`qty:${id}`, async () => {
          try {
            await api.put(`/cart/items/${id}`, { quantity });
          } catch {
            // keep local value; resync on next load
          }
        });
      },

      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));

        if (!SERVER_CART_ENABLED) return;
        debounce(`del:${id}`, async () => {
          try {
            await api.delete(`/cart/items/${id}`);
          } catch {
            /* already gone locally */
          }
        });
      },

      clearCart: (opts) => {
        set({ items: [], warnings: [], warningsAcknowledged: true });
        if (!SERVER_CART_ENABLED || opts?.skipServer) return;
        // Fire-and-forget; the checkout submission already creates an Order
        // from the cart contents, so losing this DELETE isn't critical.
        api.delete('/cart').catch(() => { /* noop */ });
      },

      getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      hasPhysicalItems: () => get().items.some((i) => i.itemType === 'PRODUCT' && i.productType === 'PHYSICAL'),
      hasDigitalItems: () => get().items.some((i) => i.itemType === 'PRODUCT' && i.productType === 'DIGITAL'),
      hasEventItems: () => get().items.some((i) => i.itemType === 'EVENT_TICKET'),
      hasTourItems: () => get().items.some((i) => i.itemType === 'SOUL_TOUR'),

      // ───── Server sync ──────────────────────────────────────────────────
      syncFromServer: async () => {
        if (!SERVER_CART_ENABLED) return;
        set({ syncing: true });
        try {
          const { data } = await api.get('/cart');
          const items: CartItem[] = Array.isArray(data?.items)
            ? data.items.map(mapServerItem)
            : [];
          const warnings = buildWarnings(items, Array.isArray(data?.removedItems) ? data.removedItems : []);
          set({
            items,
            warnings,
            warningsAcknowledged: warnings.length === 0,
            lastSyncedAt: Date.now(),
            syncing: false,
          });
        } catch {
          // Network error — keep local state; next mutation or refresh retries.
          set({ syncing: false });
        }
      },

      mergeGuestCartIntoUser: async () => {
        if (!SERVER_CART_ENABLED) return;
        try {
          await api.post('/cart/merge');
        } catch {
          /* merge is best-effort; if it fails the user still has their server cart */
        }
        // Pull the merged state back so the UI updates
        await get().syncFromServer();
      },

      acknowledgeWarnings: () => set({ warningsAcknowledged: true }),
    }),
    {
      name: 'sc-cart-v1',
      partialize: (state) => ({ items: state.items }), // never persist warnings/syncing
    },
  ),
);
