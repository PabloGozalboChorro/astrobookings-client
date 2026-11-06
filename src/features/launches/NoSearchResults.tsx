type NoSearchResultsProps = {
  query: string;
  onClear: () => void;
};

export function NoSearchResults({ query, onClear }: NoSearchResultsProps) {
  return (
    <div>
      <p>No hay lanzamientos que coincidan con «{query}».</p>
      <button type="button" onClick={onClear}>
        Borrar búsqueda
      </button>
    </div>
  );
}
