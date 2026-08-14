import Sidebar from "@/components/Sidebar";

export default function VisionPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Vision & Mood Board</h1>
        <p className="text-sm text-gray-400">
          Shared by default (board_items, visibility = shared_view) — either of
          you can add, both of you see it. Toggle to private per item if needed.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl2 border border-dashed border-base-border bg-base-panel"
            />
          ))}
        </div>
        <p className="text-xs text-gray-500">Next up: image upload to the board-images bucket.</p>
      </main>
    </div>
  );
}
