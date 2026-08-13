import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/sgp/utils";

type FieldStateProps = {
  error?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldStateProps>(function Input(
  { className, error = false, ...props },
  ref,
) {
  return <input ref={ref} className={cn("input", error && "input--error", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldStateProps>(function Textarea(
  { className, error = false, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn("textarea", error && "textarea--error", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldStateProps>(function Select(
  { className, error = false, ...props },
  ref,
) {
  return <select ref={ref} className={cn("select", error && "select--error", className)} {...props} />;
});
