"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { menuApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function imgSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

function Sheet({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-[28px] max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
        <div className="text-[18px] font-extrabold text-gray-900 px-5 pb-4 border-b border-gray-100">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function MenuPage() {
  const { restaurant } = useAuthStore();
  const isOwner = restaurant?.role === "owner" || restaurant?.role === "manager";
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm();

  const { data: categories = [], isLoading: loadCats } = useQuery<any[]>({
    queryKey: ["menu-cats", restaurant?.id],
    queryFn: () => menuApi.categories(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  useEffect(() => {
    if ((categories as any[]).length > 0 && !activeCat) setActiveCat((categories as any[])[0].id);
  }, [categories]);

  const { data: items = [], isLoading: loadItems } = useQuery<any[]>({
    queryKey: ["menu-items", restaurant?.id, activeCat],
    queryFn: () => menuApi.items(restaurant!.id, activeCat ? { category_id: activeCat } : undefined).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: toggleItem } = useMutation({
    mutationFn: (id: number) => menuApi.toggleItem(restaurant!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-items"] }),
  });

  const { mutate: deleteItem } = useMutation({
    mutationFn: (id: number) => menuApi.deleteItem(restaurant!.id, id),
    onSuccess: () => { toast.success("Item deleted"); setDeleteConfirm(null); qc.invalidateQueries({ queryKey: ["menu-items"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  const { mutate: saveItem, isPending } = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, category_id: activeCat, price: parseFloat(data.price), is_veg: data.is_veg === "true" || data.is_veg === true };
      let res;
      if (editItem) {
        res = await menuApi.updateItem(restaurant!.id, editItem.id, payload);
      } else {
        payload.is_available = true;
        res = await menuApi.createItem(restaurant!.id, payload);
      }
      if (imageFile) {
        try { await menuApi.uploadImage(restaurant!.id, res.data.id, imageFile); } catch {}
      }
      return res;
    },
    onSuccess: () => {
      toast.success(editItem ? "Item updated!" : "Item added!");
      closeSheet();
      qc.invalidateQueries({ queryKey: ["menu-items"] });
    },
    onError: () => toast.error("Failed to save item"),
  });

  function openAdd() {
    setEditItem(null); reset(); setImageFile(null); setImagePreview(null); setShowSheet(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setValue("name", item.name);
    setValue("price", item.price);
    setValue("is_veg", String(item.is_veg));
    setValue("description", item.description || "");
    setImagePreview(imgSrc(item.image_url) || null);
    setImageFile(null);
    setShowSheet(true);
  }

  function closeSheet() { setShowSheet(false); setEditItem(null); reset(); setImageFile(null); setImagePreview(null); }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[20px] font-extrabold text-gray-900">Menu</div>
          {isOwner && (
            <button onClick={openAdd} className="bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm">
              + Add Item
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scroll">
          {loadCats ? Array(4).fill(0).map((_, i) => <div key={i} className="h-8 w-20 rounded-full shimmer flex-shrink-0" />) :
            (categories as any[]).map((cat) => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap ${activeCat === cat.id ? "bg-[#25D366] text-white shadow-sm" : "bg-gray-100 text-gray-500"}`}>
                {cat.name} ({cat.item_count || 0})
              </button>
            ))
          }
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-3">
        {loadItems ? (
          <div className="grid grid-cols-2 gap-3">{Array(6).fill(0).map((_, i) => <div key={i} className="h-52 rounded-2xl shimmer" />)}</div>
        ) : (items as any[]).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🍽️</div>
            <div className="text-gray-400 text-sm">No items in this category</div>
            {isOwner && <button onClick={openAdd} className="mt-4 text-[#128C7E] font-semibold text-sm">+ Add first item</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(items as any[]).map((item) => (
              <div key={item.id} className="bg-white border-[1.5px] border-gray-100 rounded-[18px] overflow-hidden shadow-sm">
                <div className="h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden relative">
                  {imgSrc(item.image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgSrc(item.image_url)!} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{item.is_veg ? "🥗" : "🍗"}</span>
                  )}
                  {/* Owner actions overlay */}
                  {isOwner && (
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      <button onClick={() => openEdit(item)}
                        className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-xs shadow">✏️</button>
                      <button onClick={() => setDeleteConfirm(item.id)}
                        className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-xs shadow">🗑️</button>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="text-[13px] font-bold text-gray-900 leading-tight flex-1">{item.name}</div>
                    <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${item.is_veg ? "border-green-600" : "border-red-600"}`}>
                      <div className={`w-2 h-2 rounded-full ${item.is_veg ? "bg-green-600" : "bg-red-600"}`} />
                    </div>
                  </div>
                  <div className="text-[15px] font-extrabold text-gray-900 mb-2">₹{item.price}</div>
                  {isOwner && (
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.is_available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {item.is_available ? "Available" : "Off"}
                      </span>
                      <button onClick={() => toggleItem(item.id)}
                        className={`w-10 h-5 rounded-full transition-colors ${item.is_available ? "bg-[#25D366]" : "bg-gray-200"} relative flex-shrink-0`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${item.is_available ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="text-xl text-center mb-2">🗑️</div>
            <h3 className="text-[16px] font-extrabold text-gray-900 text-center mb-1">Delete Item?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">This will remove it from the menu permanently.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-700">Cancel</button>
              <button onClick={() => deleteItem(deleteConfirm)} className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={showSheet} onClose={closeSheet} title={editItem ? "Edit Item" : "Add Menu Item"}>
        <form onSubmit={handleSubmit((d) => saveItem(d))} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Item Photo (optional)</label>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gray-50 active:bg-gray-100 overflow-hidden">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <><span className="text-3xl">📷</span><span className="text-xs text-gray-400 font-semibold">Tap to upload photo</span></>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Item Name *</label>
            <input {...register("name", { required: true })} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="e.g. Chicken Rice" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Price (₹) *</label>
              <input {...register("price", { required: true })} type="number" min="0" step="0.5" className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366]" placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Type</label>
              <select {...register("is_veg")} className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-3 text-[14px] outline-none focus:border-[#25D366]">
                <option value="true">🟢 Veg</option>
                <option value="false">🔴 Non-Veg</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Description (optional)</label>
            <textarea {...register("description")} rows={2} className="w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#25D366] resize-none" placeholder="Short description..." />
          </div>
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={closeSheet} className="flex-1 py-3.5 rounded-xl border-[1.5px] border-gray-200 text-[14px] font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : (editItem ? "Save Changes" : "Add Item")}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
