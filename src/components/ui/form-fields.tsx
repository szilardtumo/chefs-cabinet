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
import { RotateCcw, Smile, Upload, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload';
import { ImagePreview } from '@/components/ui/image-preview';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagsInput } from '@/components/ui/tags-input';
import { Textarea } from '@/components/ui/textarea';
import { UnsplashCoverPhotoPicker } from '@/components/unsplash-cover-photo-picker';

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

  const value = type === 'number' && Number.isNaN(field.state.value) ? '' : (field.state.value ?? '');

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <Input
        id={field.name}
        name={field.name}
        type={type}
        value={value}
        onChange={(e) => {
          // Handle number inputs differently
          if (type === 'number') {
            field.handleChange(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber);
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
      <Select name={field.name} value={field.state.value || ''} onValueChange={field.handleChange} disabled={disabled}>
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

// #region FieldColorPicker

type FieldColorPickerProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof Input>, 'type' | 'name' | 'value' | 'onChange' | 'onBlur'> & {
    showTextInput?: boolean;
  };

export function FieldColorPicker({
  field,
  label,
  description,
  hideError,
  showTextInput = true,
  ...inputProps
}: FieldColorPickerProps) {
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

// #region FieldFileUpload

type FieldFileUploadProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof FileUpload>, 'value' | 'onValueChange' | 'name' | 'defaultValue' | 'onChange'> & {
    hideFileList?: boolean;
  };

export function FieldFileUpload({
  field,
  label,
  description,
  hideError,
  maxFiles = 1,
  maxSize,
  accept,
  multiple = false,
  hideFileList,
  ...fileUploadProps
}: FieldFileUploadProps) {
  const hasError = field.state.meta.errors.length > 0;
  const files = (field.state.value as File[]) || [];

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FileUpload
        value={files}
        onValueChange={(newFiles) => {
          field.handleChange(newFiles);
        }}
        accept={accept}
        maxFiles={maxFiles}
        maxSize={maxSize}
        multiple={multiple}
        invalid={hasError}
        {...fileUploadProps}
      >
        <FileUploadDropzone className="min-h-32">
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{files.length > 0 ? 'Replace file' : 'Drag & drop file here'}</p>
              {maxSize && (
                <p className="text-muted-foreground text-xs">
                  Or click to browse (up to {Math.round(maxSize / (1024 * 1024))}MB)
                </p>
              )}
            </div>
            <FileUploadTrigger asChild>
              <Button variant="outline" size="sm" type="button">
                Choose File
              </Button>
            </FileUploadTrigger>
          </div>
        </FileUploadDropzone>
        {!hideFileList && (
          <FileUploadList>
            {files.map((file) => (
              <FileUploadItem key={file.name} value={file}>
                <FileUploadItemPreview className="size-20" />
                <FileUploadItemMetadata />
                <FileUploadItemDelete asChild>
                  <Button variant="ghost" size="icon" className="size-7" type="button">
                    <X />
                  </Button>
                </FileUploadItemDelete>
              </FileUploadItem>
            ))}
          </FileUploadList>
        )}
      </FileUpload>
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldTagsInput

type FieldTagsInputProps = BaseFieldProps & Omit<React.ComponentProps<typeof TagsInput>, 'value' | 'onValueChange'>;

export function FieldTagsInput({ field, label, description, hideError, ...tagsInputProps }: FieldTagsInputProps) {
  const hasError = field.state.meta.errors.length > 0;
  const tags = (field.state.value as string[]) || [];

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <TagsInput
        value={tags}
        onValueChange={(newTags) => {
          field.handleChange(newTags);
        }}
        {...tagsInputProps}
      />
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldEmojiPicker

type FieldEmojiPickerProps = BaseFieldProps & {
  showRemove?: boolean;
};

export function FieldEmojiPicker({ field, label, description, hideError, showRemove = true }: FieldEmojiPickerProps) {
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

// #region FieldSlider

type FieldSliderProps = BaseFieldProps &
  Omit<React.ComponentProps<typeof Slider>, 'name' | 'value' | 'defaultValue' | 'onValueChange' | 'onBlur'>;

export function FieldSlider({ field, label, description, hideError, ...sliderProps }: FieldSliderProps) {
  const hasError = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={hasError}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {description && <FieldDescription>{description}</FieldDescription>}
      <Slider
        id={field.name}
        name={field.name}
        value={[field.state.value ?? 0]}
        onValueChange={([value]) => field.handleChange(value)}
        onBlur={field.handleBlur}
        {...sliderProps}
      />
      {!hideError && <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>}
    </Field>
  );
}

// #endregion

// #region FieldImage

type FieldImageProps = {
  /** Holds the newly picked file (`File[]`, at most one). */
  filesField: AnyFieldApi;
  /** Holds the URL of the current or an Unsplash image; the Remove button clears it to `undefined`. */
  urlField: AnyFieldApi;
  label: string;
  onReset: () => void;
  previewClassName?: string;
  /** Adds a tab for picking a photo from Unsplash next to the upload. */
  withUnsplash?: boolean;
};

export function FieldImage({
  filesField,
  urlField,
  label,
  onReset,
  previewClassName,
  withUnsplash = false,
}: FieldImageProps) {
  const hasImage = filesField.state.value.length > 0 || Boolean(urlField.state.value);
  const fileUpload = (
    <FieldFileUpload field={filesField} accept="image/*" maxFiles={1} maxSize={10 * 1024 * 1024} hideFileList />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <FieldLabel>{label}</FieldLabel>
        <Button type="button" variant="outline" className="ml-auto" onClick={onReset}>
          <RotateCcw /> Reset
        </Button>
        {hasImage && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              filesField.setValue([]);
              urlField.setValue(undefined);
            }}
          >
            <X /> Remove
          </Button>
        )}
      </div>
      <ImagePreview src={filesField.state.value[0] || urlField.state.value} className={previewClassName} />
      {withUnsplash ? (
        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="w-full">
              Upload image
            </TabsTrigger>
            <TabsTrigger value="unsplash" className="w-full">
              Browse from Unsplash
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload">{fileUpload}</TabsContent>
          <TabsContent value="unsplash">
            <UnsplashCoverPhotoPicker
              onPhotoSelected={(photo) => {
                filesField.setValue([]);
                urlField.handleChange(photo.imageUrl);
              }}
            />
          </TabsContent>
        </Tabs>
      ) : (
        fileUpload
      )}
    </div>
  );
}

// #endregion
