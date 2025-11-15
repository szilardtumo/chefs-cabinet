/**
 * Form Field Components for TanStack Form
 *
 * These components provide a simplified API for using ShadCN field components
 * with TanStack Form. They automatically handle:
 * - Field state management (value, onChange, onBlur)
 * - Error display
 * - Props pass-through to underlying components
 *
 * Usage:
 *
 * ```tsx
 * import { useForm } from "@tanstack/react-form";
 * import { FieldInput, FieldSelect, FieldTextarea, FieldCheckbox } from "@/components/ui/form-fields";
 *
 * function MyForm() {
 *   const form = useForm({ ... });
 *
 *   return (
 *     <form onSubmit={...}>
 *       {/* Text Input *\/}
 *       <form.Field
 *         name="name"
 *         children={(field) => (
 *           <FieldInput field={field} label="Name" placeholder="Enter name..." />
 *         )}
 *       />
 *
 *       {/* Textarea *\/}
 *       <form.Field
 *         name="description"
 *         children={(field) => (
 *           <FieldTextarea field={field} label="Description" rows={4} />
 *         )}
 *       />
 *
 *       {/* Select *\/}
 *       <form.Field
 *         name="category"
 *         children={(field) => (
 *           <FieldSelect
 *             field={field}
 *             label="Category"
 *             placeholder="Select a category"
 *             options={[
 *               { value: "1", label: "Option 1" },
 *               { value: "2", label: "Option 2" },
 *             ]}
 *           />
 *         )}
 *       />
 *
 *       {/* Checkbox *\/}
 *       <form.Field
 *         name="accepted"
 *         children={(field) => (
 *           <FieldCheckbox field={field} checkboxLabel="I accept the terms" />
 *         )}
 *       />
 *
 *       {/* Number Input *\/}
 *       <form.Field
 *         name="age"
 *         children={(field) => (
 *           <FieldInput field={field} label="Age" type="number" min={0} max={120} />
 *         )}
 *       />
 *
 *       {/* Color Picker *\/}
 *       <form.Field
 *         name="color"
 *         children={(field) => (
 *           <FieldColor field={field} label="Color" />
 *         )}
 *       />
 *
 *       {/* Emoji Picker *\/}
 *       <form.Field
 *         name="emoji"
 *         children={(field) => (
 *           <FieldEmoji field={field} label="Emoji" />
 *         )}
 *       />
 *     </form>
 *   );
 * }
 * ```
 *
 * All field components support:
 * - `field`: The TanStack Form field API (required)
 * - `label`: Label text for the field
 * - `description`: Helper text below the field
 * - `hideError`: Hide error messages (default: false)
 * - Additional props are passed through to the underlying component
 */

import type { AnyFieldApi } from '@tanstack/react-form';
import EmojiPicker from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// #region Helper Functions

// Helper function to extract error messages from field errors
// biome-ignore lint/suspicious/noExplicitAny: form returns errors as any[]
function getErrorMessages(errors: any[]): string {
  if (!errors || errors.length === 0) return '';

  return errors
    .map((error) => {
      // Handle different error formats
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object' && 'message' in error) return error.message;
      return String(error);
    })
    .filter(Boolean)
    .join(', ');
}

// #endregion

// #region Base Types

// Base field props type
type BaseFieldProps = {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  hideError?: boolean;
};

// #endregion

// #region FieldInput

type FieldInputProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof Input>, 'name' | 'value' | 'onChange' | 'onBlur'>;

export function FieldInput({ field, label, description, hideError, type = 'text', ...inputProps }: FieldInputProps) {
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <Input
        id={field.name}
        name={field.name}
        type={type}
        value={field.state.value}
        onChange={(e) => {
          // Handle number inputs differently
          if (type === 'number') {
            field.handleChange(e.target.valueAsNumber);
          } else {
            field.handleChange(e.target.value);
          }
        }}
        onBlur={field.handleBlur}
        {...inputProps}
      />
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldTextarea

type FieldTextareaProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof Textarea>, 'name' | 'value' | 'onChange' | 'onBlur'>;

export function FieldTextarea({ field, label, description, hideError, ...textareaProps }: FieldTextareaProps) {
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        {...textareaProps}
      />
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldSelect

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FieldSelectProps = BaseFieldProps & {
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function FieldSelect({
  field,
  label,
  description,
  hideError,
  options,
  placeholder,
  disabled,
}: FieldSelectProps) {
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <Select name={field.name} value={field.state.value} onValueChange={field.handleChange} disabled={disabled}>
        <SelectTrigger id={field.name} onBlur={field.handleBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldCheckbox

type FieldCheckboxProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof Checkbox>, 'checked' | 'onCheckedChange'> & {
    checkboxLabel?: React.ReactNode;
  };

export function FieldCheckbox({
  field,
  label,
  checkboxLabel,
  description,
  hideError,
  ...checkboxProps
}: FieldCheckboxProps) {
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError} orientation="horizontal">
      <div className="flex items-center gap-2">
        <Checkbox
          id={field.name}
          name={field.name}
          checked={field.state.value}
          onCheckedChange={field.handleChange}
          onBlur={field.handleBlur}
          {...checkboxProps}
        />
        {(label || checkboxLabel) && (
          <FieldLabel htmlFor={field.name} className="mt-0! cursor-pointer">
            {checkboxLabel || label}
          </FieldLabel>
        )}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldColor

type FieldColorProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof Input>, 'type' | 'name' | 'value' | 'onChange' | 'onBlur'> & {
    showTextInput?: boolean;
  };

export function FieldColor({
  field,
  label,
  description,
  hideError,
  showTextInput = true,
  ...inputProps
}: FieldColorProps) {
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <div className="flex gap-2">
        <Input
          type="color"
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          className="w-20 h-10"
          {...inputProps}
        />
        {showTextInput && (
          <Input
            id={field.name}
            name={field.name}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder="#000000"
          />
        )}
      </div>
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldEmoji

type FieldEmojiProps = BaseFieldProps & {
  showRemove?: boolean;
};

export function FieldEmoji({ field, label, description, hideError, showRemove = true }: FieldEmojiProps) {
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <Popover modal open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="size-9! p-0 shadow-sm" type="button">
            {field.state.value ? (
              <span className="text-2xl">{field.state.value}</span>
            ) : (
              <Smile className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 overflow-hidden" align="start">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">Emoji</span>
            {showRemove && field.state.value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  field.handleChange('');
                  setEmojiPickerOpen(false);
                }}
                className="h-auto px-2 py-1 text-xs"
              >
                Remove
              </Button>
            )}
          </div>
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              field.handleChange(emojiData.emoji);
              setEmojiPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion
