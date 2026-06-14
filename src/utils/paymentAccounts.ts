export type PaymentAccount = {
  id: number;
  tenant_id?: number;
  account_type: 'cash' | 'bank' | 'momo' | string;
  account_name: string;
  nickname?: string | null;
  account_number?: string | null;
  branch?: string | null;
  network?: string | null;
  phone_number?: string | null;
  opening_balance?: number | string;
  opening_balance_as_of?: string | null;
  opening_balance_configured?: boolean;
  is_active?: boolean;
  is_default?: boolean;
};

export type PaymentAccountBalance = PaymentAccount & {
  balance: number;
  money_in: number;
  money_out: number;
  payments_in?: number;
  income_in?: number;
  expenses_out?: number;
  transfers_in?: number;
  transfers_out?: number;
  has_transactions?: boolean;
  opening_balance_locked?: boolean;
};

export type LegacyMigrationStatus = {
  completed: boolean;
  showBanner: boolean;
  groups: { cash: number; bank: number; momo: number };
  totalUnlinked: number;
};

export type FundTransfer = {
  id: number;
  from_account_id: number;
  to_account_id: number;
  from_account_name: string;
  to_account_name: string;
  amount: number | string;
  transfer_date: string;
  note: string;
  transferred_by_name?: string;
  is_reversed: boolean;
  original_transfer_id?: number | null;
  created_at?: string;
};

export function paymentMethodFromAccountType(accountType: string): string {
  switch (accountType) {
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank Transfer';
    case 'momo':
      return 'Mobile Money';
    default:
      return 'Cash';
  }
}

export function getPaymentAccountIcon(accountType: string): string {
  switch (accountType) {
    case 'cash':
      return '💵';
    case 'bank':
      return '🏦';
    case 'momo':
      return '📱';
    default:
      return '💰';
  }
}

export function getAccountDisplayName(account: PaymentAccount): string {
  return account.nickname?.trim() || account.account_name;
}

export function formatPaymentAccountLabel(account: PaymentAccount): string {
  const icon = getPaymentAccountIcon(account.account_type);
  const name = getAccountDisplayName(account);
  if (account.account_type === 'cash') {
    return `${icon} ${name || 'Cash at Hand'}`;
  }
  if (account.account_type === 'bank') {
    const acc = account.account_number ? ` - Acc: ${account.account_number}` : '';
    return `${icon} ${name}${acc}`;
  }
  if (account.account_type === 'momo') {
    const label = account.network ? `${account.network} Momo` : name;
    const phone = account.phone_number ? ` - ${account.phone_number}` : '';
    return `${icon} ${label}${phone}`;
  }
  return `${icon} ${name}`;
}

export function formatGhs(amount: number): string {
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function maskAccountNumber(num?: string | null): string {
  if (!num) return '';
  const s = String(num);
  return s.length <= 4 ? s : `****${s.slice(-4)}`;
}

export function needsOpeningBalanceSetup(account: PaymentAccountBalance): boolean {
  return !account.opening_balance_configured && !account.has_transactions;
}
