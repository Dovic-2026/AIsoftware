"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { menuApi, salesApi } from "@/lib/api";
import toast from "react-hot-toast";

type CartItem = { id: number; name: string; price: number; qty: number; image_url?: string; is_veg?: boolean };
type PayMode = "cash" | "upi" | "card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function imgSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

// ── Mini receipt line ────────────────────────────────────────────────────────
function BillLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-[13px] ${bold ? "font-extrabold text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

export default function POSPage() {
  const { restaurant } = useAuthStore();
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [tableNo, setTableNo] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["menu-cats", restaurant?.id],
    queryFn: () => menuApi.categories(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  useEffect(() => {
    if (categories.length && !activeCat) setActiveCat(categories[0].id);
  }, [categories]);

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["menu-items", restaurant?.id, activeCat],
    queryFn: () => menuApi.items(restaurant!.id, activeCat ? { category_id: activeCat, is_available: true } : { is_available: true }).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: submitOrder, isPending: submitting } = useMutation({
    mutationFn: () => salesApi.createOrder(restaurant!.id, {
      payment_method: payMode,
      table_number: tableNo || null,
      order_type: "dine_in",
      discount: 0,
      items: cart.map((c) => ({
        menu_item_id: c.id,
        item_name: c.name,
        quantity: c.qty,
        unit_price: c.price,
      })),
    }),
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        setCart([]);
        setShowCheckout(false);
        setShowCart(false);
        setSubmitted(false);
        setTableNo("");
        setPayMode("cash");
        toast.success("✅ Sale recorded!");
      }, 1800);
    },
    onError: () => toast.error("Failed to record sale"),
  });

  function addToCart(item: any) {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, image_url: item.image_url, is_veg: item.is_veg }];
    });
  }

  function setQty(id: number, qty: number) {
    if (qty <= 0) setCart((p) => p.filter((c) => c.id !== id));
    else setCart((p) => p.map((c) => c.id === id ? { ...c, qty } : c));
  }

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + tax;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[18px] font-extrabold text-gray-900">Quick Order 🛒</h1>
            <p className="text-xs text-gray-400">Tap items to add to cart</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => { setCart([]); }} className="text-xs text-red-400 font-semibold px-3 py-1.5 rounded-xl bg-red-50">
              Clear
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div ref={catRef} className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeCat === cat.id
                  ? "bg-[#25D366] text-white shadow-sm"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-2">🍽️</div>
            <p className="text-sm font-semibold">No items in this category</p>
            <p className="text-xs mt-1">Add items from the Menu tab</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item: any) => {
              const cartItem = cart.find((c) => c.id === item.id);
              const qty = cartItem?.qty || 0;
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`relative bg-white rounded-2xl overflow-hidden shadow-sm border-2 transition-all active:scale-95 text-left ${
                    qty > 0 ? "border-[#25D366]" : "border-transparent"
                  }`}
                >
                  {/* Image */}
                  <div className="w-full h-28 bg-gray-100 relative overflow-hidden">
                    {imgSrc(item.image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc(item.image_url)!} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                    )}
                    {/* Veg badge */}
                    <div className={`absolute top-1.5 left-1.5 w-4 h-4 rounded border-2 flex items-center justify-center ${item.is_veg ? "border-green-600 bg-white" : "border-red-600 bg-white"}`}>
                      <div className={`w-2 h-2 rounded-full ${item.is_veg ? "bg-green-600" : "bg-red-600"}`} />
                    </div>
                    {/* Qty badge */}
                    {qty > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-[#25D366] text-white text-[11px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center shadow">
                        {qty}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-[13px] font-bold text-gray-900 leading-tight line-clamp-2">{item.name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[13px] font-extrabold text-[#128C7E]">₹{item.price}</span>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors ${qty > 0 ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-400"}`}>
                        +
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Bar */}
      {cart.length > 0 && !showCart && !showCheckout && (
        <div className="px-4 pb-4 flex-shrink-0">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-[#25D366] text-white rounded-2xl py-4 px-5 flex items-center justify-between shadow-lg shadow-green-200 active:scale-95 transition-transform"
          >
            <div className="bg-white/20 rounded-xl px-2.5 py-1 text-sm font-extrabold">{totalItems} items</div>
            <span className="text-[15px] font-extrabold">View Cart →</span>
            <span className="text-[15px] font-extrabold">₹{subtotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end" onClick={(e) => e.target === e.currentTarget && setShowCart(false)}>
          <div className="bg-white w-full rounded-t-[28px] max-h-[80vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[17px] font-extrabold text-gray-900">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {imgSrc(item.image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc(item.image_url)!} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">₹{item.price} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(item.id, item.qty - 1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200">−</button>
                    <span className="text-[15px] font-extrabold text-gray-900 w-5 text-center">{item.qty}</span>
                    <button onClick={() => setQty(item.id, item.qty + 1)} className="w-8 h-8 rounded-full bg-[#25D366] text-white font-bold text-lg flex items-center justify-center active:bg-[#128C7E]">+</button>
                  </div>
                  <span className="text-[13px] font-extrabold text-gray-900 w-14 text-right">₹{(item.qty * item.price).toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Table number */}
            <div className="px-4 pb-2">
              <input
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                placeholder="Table no. (optional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-[#25D366]"
              />
            </div>

            {/* Summary */}
            <div className="px-4 py-3 border-t border-gray-100 space-y-1.5">
              <BillLine label="Subtotal" value={`₹${subtotal.toFixed(2)}`} />
              <BillLine label="GST (5%)" value={`₹${tax.toFixed(2)}`} />
              <BillLine label="Total" value={`₹${grandTotal.toFixed(2)}`} bold />
            </div>

            <div className="px-4 pb-6">
              <button
                onClick={() => { setShowCart(false); setShowCheckout(true); }}
                className="w-full py-4 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-extrabold text-[15px] rounded-2xl shadow-lg shadow-green-200 active:scale-95 transition-transform"
              >
                Proceed to Checkout →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout / Bill Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-[28px] max-h-[90vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[17px] font-extrabold text-gray-900">Bill Summary</h2>
              {!submitted && <button onClick={() => { setShowCheckout(false); setShowCart(true); }} className="text-gray-400 text-xl">✕</button>}
            </div>

            {submitted ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
                <div className="text-6xl animate-bounce">✅</div>
                <p className="text-[18px] font-extrabold text-gray-900">Sale Recorded!</p>
                <p className="text-sm text-gray-400">₹{grandTotal.toFixed(2)} via {payMode.toUpperCase()}</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {/* Receipt header */}
                  <div className="text-center mb-4 pb-4 border-b border-dashed border-gray-200">
                    <p className="text-[15px] font-extrabold text-gray-900">{restaurant?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    {tableNo && <p className="text-xs text-gray-500 mt-0.5">Table: {tableNo}</p>}
                  </div>

                  {/* Items */}
                  <div className="space-y-2 mb-4 pb-4 border-b border-dashed border-gray-200">
                    <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      <span>Item</span><span>Qty × Price</span><span>Total</span>
                    </div>
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between text-[13px] text-gray-700">
                        <span className="flex-1 truncate pr-2">{item.name}</span>
                        <span className="text-gray-500 w-20 text-center">{item.qty} × ₹{item.price}</span>
                        <span className="font-bold w-16 text-right">₹{(item.qty * item.price).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1.5 mb-5 pb-4 border-b border-dashed border-gray-200">
                    <BillLine label="Subtotal" value={`₹${subtotal.toFixed(2)}`} />
                    <BillLine label="GST (5%)" value={`₹${tax.toFixed(2)}`} />
                    <div className="pt-1.5">
                      <BillLine label={`TOTAL`} value={`₹${grandTotal.toFixed(2)}`} bold />
                    </div>
                  </div>

                  {/* Payment mode */}
                  <div className="mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["cash", "upi", "card"] as PayMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setPayMode(mode)}
                          className={`py-3 rounded-2xl text-sm font-extrabold border-2 transition-all active:scale-95 ${
                            payMode === mode
                              ? "border-[#25D366] bg-green-50 text-[#128C7E]"
                              : "border-gray-100 bg-gray-50 text-gray-500"
                          }`}
                        >
                          {mode === "cash" ? "💵 Cash" : mode === "upi" ? "📱 UPI" : "💳 Card"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-8 pt-2">
                  <button
                    onClick={() => submitOrder()}
                    disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-extrabold text-[16px] rounded-2xl shadow-lg shadow-green-200 active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Recording...</>
                    ) : (
                      `✓ Record Sale — ₹${grandTotal.toFixed(2)}`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
