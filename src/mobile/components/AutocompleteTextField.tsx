import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AutocompleteTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}

const AutocompleteTextField: React.FC<AutocompleteTextFieldProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on input
  const filteredOptions = options.filter(
    (option) => option.toLowerCase().includes(value.toLowerCase()) && option !== value
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <Label>{label} {required && '*'}</Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        required={required}
      />
      
      {showSuggestions && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => {
                onChange(option);
                setShowSuggestions(false);
              }}
              className="px-3 py-3 text-sm text-foreground hover:bg-secondary cursor-pointer border-b border-border/50 last:border-0"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteTextField;
