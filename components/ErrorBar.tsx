'use client';

export default function ErrorBar({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null;
  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span>{error}</span>
      <button onClick={onClose} className="text-red-500">✕</button>
    </div>
  );
}
