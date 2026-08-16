"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Image as ImageIcon, StickyNote, Trash2, X, GripVertical } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useHousehold } from "@/lib/HouseholdContext";

// Per-person boards (2026-08-16): each household member gets their own
// mood board, plus one "Shared" board everyone contributes to. Existing
// single-board installs migrate forward automatically -- any item with no
// boardId is treated as "shared" the first time this loads, and gets
// stamped with boardId: "shared" so the migration only ever runs once.
type BoardItem = {
  id: string;
  boardId: string; // real profile uuid, or "shared"
  type: "photo" | "note";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  src?: string;
  text?: string;
};

const SHARED_BOARD = { id: "shared", name: "Shared" };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Downscales (max 1600px on the long edge) and re-encodes to WebP before
// the photo ever touches storage -- mood-board photos were previously
// stored as full-resolution data URLs, which is what made the ~5-10MB
// localStorage cap bite so fast. Falls back to the original file's data
// URL if canvas/WebP isn't available (very old browsers) rather than
// failing the upload outright.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressToWebp(file: File): Promise<string> {
  const original = await readFileAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = original;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    const webp = canvas.toDataURL("image/webp", WEBP_QUALITY);
    // Some browsers silently fall back to PNG from toDataURL("image/webp",...)
    // if WebP encoding isn't supported -- only use the result if it's
    // actually WebP, otherwise keep the untouched original.
    return webp.startsWith("data:image/webp") ? webp : original;
  } catch {
    return original;
  }
}

export default function VisionBoard() {
  const { members } = useHousehold();
  const boards = useMemo(() => [...members, SHARED_BOARD], [members]);

  const [rawItems, setItems] = useLocalStorage<BoardItem[]>("visionBoardItems", []);
  // One-time migration: any pre-existing item with no boardId belonged to
  // the old single flat board -- treat it as "shared" going forward.
  const items = useMemo<BoardItem[]>(
    () => rawItems.map((it) => ({ ...it, boardId: it.boardId ?? "shared" })),
    [rawItems]
  );
  useEffect(() => {
    if (rawItems.some((it) => !it.boardId)) {
      setItems((prev) => prev.map((it) => ({ ...it, boardId: it.boardId ?? "shared" })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeBoard, setActiveBoard] = useState<string>("shared");
  useEffect(() => {
    // If the previously-active board (e.g. a member removed from the
    // household) no longer exists, fall back to Shared rather than
    // silently showing an empty board with no way to tell why.
    if (!boards.some((b) => b.id === activeBoard)) setActiveBoard("shared");
  }, [boards, activeBoard]);

  const boardItems = useMemo(() => items.filter((it) => it.boardId === activeBoard), [items, activeBoard]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startW: number; startH: number; startX: number; startY: number } | null>(null);
  const [uploading, setUploading] = useState(false);

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
      const countOnBoard = prev.filter((it) => it.boardId === activeBoard).length;
      const maxZ = prev.reduce((m, it) => Math.max(m, it.z), 0);
      const base: BoardItem = {
        id,
        boardId: activeBoard,
        type: partial.type,
        x: 24 + (countOnBoard % 4) * 40,
        y: 24 + (countOnBoard % 4) * 30,
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

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const src = await compressToWebp(file);
        addItem({ type: "photo", src });
      }
    } finally {
      setUploading(false);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const clearBoard = () => {
    if (boardItems.length === 0) return;
    const boardName = boards.find((b) => b.id === activeBoard)?.name ?? "this";
    if (window.confirm(`Clear ${boardName}'s board? This can't be undone.`)) {
      setItems((prev) => prev.filter((it) => it.boardId !== activeBoard));
      setSelectedId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setActiveBoard(b.id);
              setSelectedId(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeBoard === b.id ? "bg-accent-purple text-white" : "glass-card text-gray-400 hover:text-white"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="glossy-gradient rounded-full bg-gradient-to-br from-accent-pink to-rose-400 px-4 py-2 text-sm font-medium text-white shadow-glow-pink disabled:opacity-60"
        >
          <span className="relative z-10 flex items-center gap-2">
            <ImageIcon size={16} /> {uploading ? "Adding..." : "Add photo"}
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
            <Trash2 size={14} /> Clear this board
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
        {boardItems.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            Empty board — add a photo or note to get started.
          </p>
        )}

        {boardItems.map((item) => {
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
        Saved to this browser for now ({boardItems.length} item{boardItems.length === 1 ? "" : "s"} on this board,{" "}
        {items.length} total) — photos are compressed to WebP before storage. Will sync to shared cloud storage
        once the board-images bucket is wired up.
      </p>
    </div>
  );
}
