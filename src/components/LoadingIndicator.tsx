type LoadingIndicatorProps = {
  label?: string;
};

export function LoadingIndicator({ label = 'Cargando…' }: LoadingIndicatorProps) {
  return <p role="status">{label}</p>;
}
