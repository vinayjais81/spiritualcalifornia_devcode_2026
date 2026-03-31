import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItemType = 'PRODUCT' | 'EVENT_TICKET' | 'SOUL_TOUR' | 'SERVICE_BOOKING';

export interface CartItem {
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
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
  hasPhysicalItems: () => boolean;
  hasDigitalItems: () => boolean;
  hasEventItems: () => boolean;
  hasTourItems: () => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const id = `${item.itemType}-${item.itemId}-${item.variantId || 'default'}`;
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === id ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, id }] };
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
      },

      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      clearCart: () => set({ items: [] }),

      getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      hasPhysicalItems: () => get().items.some((i) => i.itemType === 'PRODUCT' && i.productType === 'PHYSICAL'),
      hasDigitalItems: () => get().items.some((i) => i.itemType === 'PRODUCT' && i.productType === 'DIGITAL'),
      hasEventItems: () => get().items.some((i) => i.itemType === 'EVENT_TICKET'),
      hasTourItems: () => get().items.some((i) => i.itemType === 'SOUL_TOUR'),
    }),
    { name: 'sc-cart-v1' },
  ),
);
