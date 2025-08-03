import { InputHTMLAttributes } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  name?: string;
  label?: string;
  description?: string;
  value?: string;
  placeholder?: string;
  className?: string;
  containerClasses?: string;
  onInput?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TextField({
  name,
  label,
  description,
  placeholder,
  value,
  onInput,
  className = "",
  containerClasses = "",
}: TextInputProps) {
  return (
    <div className={containerClasses}>
      <div className="w-full relative mb-8">
        {label && (
          <div className="flex items-center mb-1 text-gray-600">
            <label className="label-form">{label}</label>
          </div>
        )}
        {description && (
          <div className="flex items-center mb-1 text-gray-400">
            <div className="label-form">{description}</div>
          </div>
        )}
        <input
          name={name}
          placeholder={placeholder}
          value={value}
          onInput={onInput}
          className={`px-6 h-12 w-full rounded-md text-base border-2 border-slate-200 placeholder-slate-400 text-slate-800 focus-visible:outline-0 ${className}`}
        />
      </div>
    </div>
  );
}