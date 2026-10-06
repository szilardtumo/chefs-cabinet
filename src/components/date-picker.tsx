import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  id?: string;
  value?: Date;
  onValueChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
  /** Earliest day that can be picked; days after today can never be picked. */
  minDate?: Date;
};

export function DatePicker({
  id,
  value,
  onValueChange,
  placeholder = 'Select date',
  className,
  minDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          {value ? formatDate(value) : placeholder}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          required
          selected={value}
          defaultMonth={value}
          captionLayout="dropdown"
          startMonth={new Date(1990, 0)}
          endMonth={new Date()}
          disabled={[{ after: new Date() }, minDate ? { before: minDate } : false]}
          onSelect={(date) => {
            onValueChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
