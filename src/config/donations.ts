// Central place to configure crypto donation addresses.
// Fill in the addresses you want to accept donations to. Leave empty strings to hide an option.

export const DONATION_ADDRESSES = {
  BTC: 'bc1q96jpm9suuqu8rceak8259flqwlzr2tk6l8agz0', //
  ETH: '0x2a17B4610D1552fc778c608B9cabdf2415B126e0', //
  SOL: '5W5Zb42Dmp7xJqguD64hFQCnHif2T5XvgQ2gx5BDaxNC', //
  XRP: 'rNdWoAvEsFKHoo3rjxDTmwvVLdAokpqUnj', //
} as const;

export type SupportedSymbol = keyof typeof DONATION_ADDRESSES; // 'BTC' | 'ETH' | 'SOL' | 'XRP'

export const SYMBOL_META: Record<SupportedSymbol, { label: string; scheme: string }>
  = {
    BTC: { label: 'Bitcoin', scheme: 'bitcoin' },
    ETH: { label: 'Ethereum', scheme: 'ethereum' },
    SOL: { label: 'Solana', scheme: 'solana' },
    XRP: { label: 'XRP', scheme: 'xrp' },
  };
