export function formatTokens(count: number): string {
  if (count < 1000) return count.toLocaleString('en-US');
  if (count < 100_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}K`;
  return `${(count / 1_000_000).toFixed(2).replace(/0$/, '').replace(/\.$/, '')}M`;
}
