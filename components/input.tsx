import React, { useEffect, useRef, useState } from "react";
import { Error } from "@/components/error";
import clsx from "clsx";

const sizes = {
  xSmall: "h-6 text-xs rounded-md",
  small: "h-8 text-sm rounded-md",
  mediumSmall: "h-9 text-sm rounded-md",
  medium: "h-9 text-sm rounded-md",
  large: "h-10 text-sm rounded-lg"
};

interface InputProps {
  placeholder?: string;
  size?: keyof typeof sizes;
  prefix?: React.ReactNode | string;
  suffix?: React.ReactNode | string;
  prefixStyling?: boolean | string;
  suffixStyling?: boolean | string;
  disabled?: boolean;
  error?: string | boolean;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  ref?: React.RefObject<HTMLInputElement | null>;
  className?: string;
  wrapperClassName?: string;
}

export const Input = ({
  placeholder,
  size = "medium",
  prefix,
  suffix,
  prefixStyling = true,
  suffixStyling = true,
  disabled = false,
  error,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  ref,
  className,
  wrapperClassName,
  ...rest
}: InputProps) => {
  const [_value, set_value] = useState(value || "");
  const _ref = ref ? ref : useRef<HTMLInputElement>(null);

  const _onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    set_value(e.target.value);
    if (onChange) {
      onChange(e.target.value);
    }
  };

  useEffect(() => {
    if (value !== undefined) {
      set_value(value);
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2" onClick={() => _ref.current?.focus()}>
      {label && (
        <div className="capitalize text-[13px] text-gray-900">
          {label}
        </div>
      )}
      <div className={clsx(
        "flex items-center duration-150 font-medium shadow-sm",
        error ? "border border-red-300 bg-red-50 shadow-sm hover:shadow-md focus-within:border-red-500 focus-within:shadow-md" : "border border-gray-300 bg-white hover:border-gray-400 hover:shadow-md focus-within:border-blue-500 focus-within:shadow-md focus-within:ring-1 focus-within:ring-blue-500/20",
        sizes[size],
        disabled ? "cursor-not-allowed bg-gray-100 border-gray-200" : "",
        wrapperClassName
      )}>
        {prefix && (
          <div
            className={clsx(
              "text-gray-700 fill-gray-700 h-full flex items-center justify-center",
              prefixStyling === true ? "bg-background-200 border-r border-gray-alpha-400 px-3" : `pl-3${!prefixStyling ? "" : ` ${prefixStyling}`}`,
              size === "large" ? "rounded-l-lg" : "rounded-l-md"
            )}>
            {prefix}
          </div>
        )}
        <input
          className={clsx(
            "w-full inline-flex appearance-none placeholder:text-gray-500 placeholder:opacity-70 outline-none font-medium",
            (size === "xSmall" || size === "mediumSmall") ? "px-3" : "px-3",
            disabled ? "cursor-not-allowed bg-gray-100 text-gray-700" : "bg-white text-gray-900",
            className
          )}
          placeholder={placeholder}
          disabled={disabled}
          value={_value}
          onChange={_onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          ref={_ref}
          {...rest}
        />
        {suffix && (
          <div className={clsx(
            "text-gray-700 fill-gray-700 h-full flex items-center justify-center",
            suffixStyling === true ? "bg-background-200 border-l border-gray-alpha-400 px-3" : `pr-3 ${!suffixStyling ? "" : ` ${suffixStyling}`}`,
            size === "large" ? "rounded-r-lg" : "rounded-r-md"
          )}>
            {suffix}
          </div>
        )}
      </div>
      {typeof error === "string" && <Error size={size === "large" ? "large" : "small"}>{error}</Error>}
    </div>
  );
};