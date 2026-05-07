export function RagPill({ rag }: { rag: 'Green' | 'Amber' | 'Red' | null | undefined }) {
  if (!rag) return <span className="text-slate-300">—</span>;
  const cls = rag === 'Green' ? 'rag-green' : rag === 'Amber' ? 'rag-amber' : 'rag-red';
  return <span className={`rag-pill ${cls}`}>{rag}</span>;
}
