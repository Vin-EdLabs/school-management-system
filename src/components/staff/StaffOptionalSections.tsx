import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';

type EmergencyFields = { name: string; phone: string; relationship: string };
type BankFields = { bankName: string; accountName: string; accountNumber: string; branch: string };

type Props = {
  showEmergency: boolean;
  showBank: boolean;
  onToggleEmergency: () => void;
  onToggleBank: () => void;
  emergency: EmergencyFields;
  bank: BankFields;
  onEmergencyChange: (field: keyof EmergencyFields, value: string) => void;
  onBankChange: (field: keyof BankFields, value: string) => void;
};

const StaffOptionalSections: React.FC<Props> = ({
  showEmergency,
  showBank,
  onToggleEmergency,
  onToggleBank,
  emergency,
  bank,
  onEmergencyChange,
  onBankChange,
}) => (
  <div className="space-y-3 pt-2">
    <div>
      <Button type="button" variant="ghost" size="sm" className="px-0 h-8" onClick={onToggleEmergency}>
        {showEmergency ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
        {showEmergency ? 'Hide Emergency Contact' : 'Add Emergency Contact (optional)'}
      </Button>
      {showEmergency && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pl-1 border-l-2 border-muted ml-1 pl-4">
          <div className="space-y-2">
            <Label>Contact Name</Label>
            <Input value={emergency.name} onChange={(e) => onEmergencyChange('name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input value={emergency.phone} onChange={(e) => onEmergencyChange('phone', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Relationship</Label>
            <Select value={emergency.relationship} onValueChange={(v) => onEmergencyChange('relationship', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Spouse">Spouse</SelectItem>
                <SelectItem value="Parent">Parent</SelectItem>
                <SelectItem value="Sibling">Sibling</SelectItem>
                <SelectItem value="Friend">Friend</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>

    <div>
      <Button type="button" variant="ghost" size="sm" className="px-0 h-8" onClick={onToggleBank}>
        {showBank ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
        {showBank ? 'Hide Bank Details' : 'Add Bank Details (optional)'}
      </Button>
      {showBank && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pl-1 border-l-2 border-muted ml-1 pl-4">
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input value={bank.bankName} onChange={(e) => onBankChange('bankName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input value={bank.accountName} onChange={(e) => onBankChange('accountName', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input value={bank.accountNumber} onChange={(e) => onBankChange('accountNumber', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Input value={bank.branch} onChange={(e) => onBankChange('branch', e.target.value)} />
          </div>
        </div>
      )}
    </div>
  </div>
);

export default StaffOptionalSections;
