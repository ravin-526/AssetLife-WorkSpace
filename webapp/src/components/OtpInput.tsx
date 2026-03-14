import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type OtpInputProps = {
  length?: number;
  value?: string;
  onChange: (otp: string) => void;
  disabled?: boolean;
};

const OtpInput = ({ length = 6, value, onChange, disabled = false }: OtpInputProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const normalizedLength = Math.max(1, length);

  const initialDigits = useMemo(() => {
    const seed = (value ?? "").replace(/\D/g, "").slice(0, normalizedLength);
    return Array.from({ length: normalizedLength }, (_, index) => seed[index] ?? "");
  }, [normalizedLength, value]);

  const [digits, setDigits] = useState<string[]>(initialDigits);

  useEffect(() => {
    setDigits(initialDigits);
  }, [initialDigits]);

  const emitChange = (nextDigits: string[]) => {
    onChange(nextDigits.join(""));
  };

  const focusInput = (index: number) => {
    if (index < 0 || index >= normalizedLength) {
      return;
    }
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  };

  const handleDigitUpdate = (index: number, nextValue: string) => {
    const numeric = nextValue.replace(/\D/g, "");

    if (!numeric) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      emitChange(nextDigits);
      return;
    }

    const nextDigits = [...digits];
    const chars = numeric.split("");

    let pointer = index;
    for (const char of chars) {
      if (pointer >= normalizedLength) {
        break;
      }
      nextDigits[pointer] = char;
      pointer += 1;
    }

    setDigits(nextDigits);
    emitChange(nextDigits);

    if (pointer < normalizedLength) {
      focusInput(pointer);
    } else {
      focusInput(normalizedLength - 1);
    }
  };

  const handleInputChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    handleDigitUpdate(index, event.target.value);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index]) {
      event.preventDefault();
      const previousIndex = index - 1;
      if (previousIndex >= 0) {
        const nextDigits = [...digits];
        nextDigits[previousIndex] = "";
        setDigits(nextDigits);
        emitChange(nextDigits);
        focusInput(previousIndex);
      }
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, normalizedLength);
    if (!pasted) {
      return;
    }

    const nextDigits = Array.from({ length: normalizedLength }, (_, index) => pasted[index] ?? "");
    setDigits(nextDigits);
    emitChange(nextDigits);

    const nextFocusIndex = Math.min(pasted.length, normalizedLength) - 1;
    focusInput(nextFocusIndex >= 0 ? nextFocusIndex : 0);
  };

  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "center", alignItems: "center" }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleInputChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1}`}
          style={{
            width: "46px",
            height: "50px",
            textAlign: "center",
            fontSize: "1.25rem",
            borderRadius: "8px",
            border: "1px solid #c4c4c4",
            outline: "none",
          }}
        />
      ))}
    </div>
  );
};

export default OtpInput;
