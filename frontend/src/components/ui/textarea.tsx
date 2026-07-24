import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full bg-surface-2 border border-line rounded-8 text-fg px-3 py-2.5 outline-none resize-y font-sans text-[13px] leading-relaxed placeholder:text-muted',
        className,
      )}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';
