"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Image as ImageIcon, StickyNote, Trash2, X, GripVertical } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";

type BoardItem = {
  id: string;
  type: "photo" | "note";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  src?: string;
  text?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function VisionBoard() {
  const [items, setItems] = useLocalStorage<BoardItem[]>("visionBoardItems", []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startW: number; startH: number; startX: number; startY: number } | null>(null);

  const bringToFront = useCallback(
    (id: string) => {
      setItems((prev) => {
        const maxZ = prev.reduce((m, it) => Math.max(m, it.z), 0);
        return prev.map((it) => (it.id === id ? { ...it, z: maxZ + 1 } : it));
      });
    },
    [setItems]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const board = boardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();

      if (dragRef.current) {
        const { id, offsetX, offsetY } = dragRef.current;
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            const x = Math.max(0, Math.min(e.clientX - rect.left - offsetX, rect.width - it.w));
            const y = Math.max(0, Math.min(e.clientY - rect.top - offsetY, rect.height - it.h));
            return { ...it, x, y };
          })
        );
      }

      if (resizeRef.current) {
        const { id, startW, startH, startX, startY } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            const w = Math.max(90, Math.min(startW + dx, rect.width - it.x));
            const h = Math.max(90, Math.min(startH + dy, rect.height - it.y));
            return { ...it, w, h };
          })
        );
      }
    },
    [setItems]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, item: BoardItem) => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    dragRef.current = {
      id: item.id,
      offsetX: e.clientX - rect.left - item.x,
      offsetY: e.clientY - rect.top - item.y,
    };
    setSelectedId(item.id);
    bringToFront(item.id);
  };

  const startResize = (e: ReactPointerEvent<HTMLDivElement>, item: BoardItem) => {
    e.stopPropagation();
    resizeRef.current = { id: item.id, startW: item.w, startH: item.h, startX: e.clientX, startY: e.clientY };
    setSelectedId(item.id);
    bringToFront(item.id);
  };

  const addItem = (partial: { type: "photo" | "note"; src?: string }) => {
    const id = uid();
    setItems((prev) => {
      const maxZ = prev.reduce((m, it) => Math.max(m, it.z), 0);
      const count = prev.length;
      const base: BoardItem = {
        id,
        type: partial.type,
        x: 24 + (count % 4) * 40,
        y: 24 + (count % 4) * 30,
        w: partial.type === "photo" ? 180 : 190,
        h: partial.type === "photo" ? 180 : 150,
        z: maxZ + 1,
        src: partial.src,
        text: "",
      };
      return [...prev, base];
    });
    setSelectedId(id);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => addItem({ type: "photo", src: reader.result as string });
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const clearBoard = () => {
    if (items.length === 0) return;
    if (window.confirm("Clear the whole board? This can't be undone.")) {
      setItems([]);
      setSelectedId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="glossy-gradient rounded-full bg-gradient-to-br from-accent-pink to-rose-400 px-4 py-2 text-sm font-medium text-white shadow-glow-pink"
        >
          <span className="relative z-10 flex items-center gap-2">
            <ImageIcon size={16} /> Add photo
          </span>
        </button>
        <button
          type="button"
          onClick={() => addItem({ type: "note" })}
          className="glossy-gradient rounded-full bg-gradient-to-br from-accent-blue to-sky-500 px-4 py-2 text-sm font-medium text-white shadow-glow-blue"
        >
          <span className="relative z-10 flex items-center gap-2">
            <StickyNote size={16} /> Add note
          </span>
        </button>
        <button
          type="button"
          onClick={clearBoard}
          className="glass-card ml-auto rounded-full px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          <span className="relative z-10 flex items-center gap-2">
            <Trash2 size={14} /> Clear board
          </span>
        </button>
      </div>

      <div
        ref={boardRef}
        onClick={() => setSelectedId(null)}
        className="glass-card relative min-h-[560px] w-full overflow-hidden rounded-xl2"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {items.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            Empty board — add a photo or note to get started.
          </p>
        )}

        {items.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(item.id);
              }}
              className={`glass-card absolute select-none overflow-hidden rounded-xl2 ${
                isSelected ? "ring-2 ring-accent-purple" : ""
              }`}
              style={{ left: item.x, top: item.y, width: item.w, height: item.h, zIndex: item.z }}
            >
              <div
                onPointerDown={(e) => startDrag(e, item)}
                className="relative z-10 flex cursor-grab items-center justify-between border-b border-white/10 bg-black/20 px-2 py-1 active:cursor-grabbing"
              >
                <GripVertical size={12} className="text-gray-400" />
                {isSelected && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="relative z-10" style={{ height: "calc(100% - 24px)" }}>
                {item.type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.src} alt="" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  <textarea
                    value={item.text}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, text: e.target.value } : it)))
                    }
                    placeholder="Type a note..."
                    className="h-full w-full resize-none bg-gradient-to-br from-accent-orange/20 to-transparent p-2 text-sm text-gray-100 outline-none placeholder:text-gray-500"
                  />
                )}
              </div>

              {isSelected && (
                <div
                  onPointerDown={(e) => startResize(e, item)}
                  className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize rounded-tl bg-accent-purple/80"
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Saved to this browser for now ({items.length} item{items.length === 1 ? "" : "s"}) — will sync to shared
        cloud storage once the board-images bucket is wired up.
      </p>
    </div>
  );
}
