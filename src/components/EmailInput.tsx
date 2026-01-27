'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface EmailInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  className?: string;
  onInputChange?: (value: string) => void;
  inputValue?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export default function EmailInput({ value, onChange, placeholder, className, onInputChange, inputValue: propInputValue, onKeyDown }: EmailInputProps) {
  const [localInputValue, setInputValue] = useState('');
  const [isProcessingEnter, setIsProcessingEnter] = useState(false);

  // Use propInputValue if provided, otherwise use local state
  const currentInputValue = propInputValue !== undefined ? propInputValue : localInputValue;
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Email validation regex
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (propInputValue !== undefined && onInputChange) {
      onInputChange(newValue);
    } else {
      setInputValue(newValue);
    }
  };

  // Add an email to the list
  const addEmail = (email: string) => {
    if (email && isValidEmail(email) && !value.includes(email)) {
      onChange([...value, email]);
      // Only clear the input if not controlled externally
      if (propInputValue === undefined) {
        setInputValue('');
      } else if (onInputChange) {
        onInputChange('');
      }
    }
  };

  // Remove an email from the list
  const removeEmail = (index: number) => {
    const newEmails = [...value];
    newEmails.splice(index, 1);
    onChange(newEmails);
  };

  // Handle key events
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) {
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentInputValue.trim() && isValidEmail(currentInputValue.trim())) {
        // Set the processing flag to prevent blur from adding the same email
        setIsProcessingEnter(true);
        addEmail(currentInputValue.trim());

        // Reset the flag after a short delay
        setTimeout(() => {
          setIsProcessingEnter(false);
        }, 150); // Slightly longer than typical blur delay
      }
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (currentInputValue.trim() && isValidEmail(currentInputValue.trim())) {
        addEmail(currentInputValue.trim());
      }
    } else if (e.key === 'Backspace' && currentInputValue === '' && value.length > 0) {
      e.preventDefault();
      removeEmail(value.length - 1);
    }
  };

  // Handle paste event to parse multiple emails
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const emailArray = pastedText
      .split(/[,\s;]+/)
      .map(email => email.trim())
      .filter(email => email !== '');

    const validEmails = emailArray.filter(email => isValidEmail(email) && !value.includes(email));

    if (validEmails.length > 0) {
      onChange([...value, ...validEmails]);
    }

    // Set any remaining text as input value if it's not a valid email
    const remainingText = emailArray
      .filter(email => !isValidEmail(email))
      .join(' ');

    if (remainingText) {
      if (propInputValue !== undefined && onInputChange) {
        onInputChange(remainingText);
      } else {
        setInputValue(remainingText);
      }
    }
  };

  // Handle click on container to focus input
  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle blur to add email if valid (but not if we just processed Enter)
  const handleBlur = () => {
    // Only add email if we're not in the middle of processing Enter
    if (!isProcessingEnter && currentInputValue.trim() && isValidEmail(currentInputValue.trim())) {
      addEmail(currentInputValue.trim());
    }
    setIsFocused(false);
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
  };

  // Handle double-click on bubble to edit
  const handleBubbleDoubleClick = (email: string, index: number) => {
    removeEmail(index);
    const newInputValue = email;
    if (propInputValue !== undefined && onInputChange) {
      onInputChange(newInputValue);
    } else {
      setInputValue(newInputValue);
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={cn(
        "flex flex-wrap items-center gap-2 min-h-[44px] w-full p-2 border border-gray-300 rounded-lg bg-white transition-colors",
        isFocused ? "ring-2 ring-blue-500 border-blue-500" : "focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500",
        className
      )}
    >
      {value.map((email, index) => (
        <div
          key={index}
          onDoubleClick={() => handleBubbleDoubleClick(email, index)}
          className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
        >
          <span>{email}</span>
          <span className="text-[10px] text-blue-500 translate-y-1 select-none">#{index + 1}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeEmail(index);
            }}
            className="text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-200 p-0.5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="email"
        value={currentInputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown as any}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm"
      />
    </div>
  );
}
