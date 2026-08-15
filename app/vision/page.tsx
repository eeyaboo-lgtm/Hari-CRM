import Sidebar from "@/components/Sidebar";
import VisionBoard from "@/components/VisionBoard";
import VisionGoals from "@/components/VisionGoals";

export default function VisionPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Vision & Mood Board</h1>
          <p className="mt-1 text-sm text-gray-400">
            Shared by default — either of you can add, move, resize, or delete. Drag the grip handle at the top of
            a card to move it, drag the corner handle to resize, click the × to delete.
          </p>
        </div>
        <VisionGoals />
        <VisionBoard />
      </main>
    </div>
  );
}
