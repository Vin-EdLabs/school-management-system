import React, { useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaymentAccounts } from '../../hooks/usePaymentAccounts';
import {
  formatPaymentAccountLabel,
  paymentMethodFromAccountType,
  type PaymentAccount,
} from '../../utils/paymentAccounts';

type PaymentAccountSelectProps = {
  value?: string;
  onChange: (accountId: string, paymentMethod: string, account?: PaymentAccount) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
};

const PaymentAccountSelect: React.FC<PaymentAccountSelectProps> = ({
  value,
  onChange,
  disabled,
  label = 'Payment Account',
  id = 'paymentAccount',
}) => {
  const { accounts, defaultAccount, loading } = usePaymentAccounts();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current || value || !defaultAccount) return;
    didInit.current = true;
    onChange(
      String(defaultAccount.id),
      paymentMethodFromAccountType(defaultAccount.account_type),
      defaultAccount
    );
  }, [value, defaultAccount, onChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || (defaultAccount ? String(defaultAccount.id) : '')}
        onValueChange={(accountId) => {
          const account = accounts.find((a) => String(a.id) === accountId);
          onChange(
            accountId,
            account ? paymentMethodFromAccountType(account.account_type) : 'Cash',
            account
          );
        }}
        disabled={disabled || loading || accounts.length === 0}
      >
        <SelectTrigger id={id} disabled={disabled || loading || accounts.length === 0}>
          <SelectValue placeholder={loading ? 'Loading accounts…' : 'Select payment account'} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={String(account.id)}>
              {formatPaymentAccountLabel(account)}
              {account.is_default ? ' (Default)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PaymentAccountSelect;
