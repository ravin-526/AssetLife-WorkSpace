import { Dispatch, SetStateAction, useEffect } from "react";

type UseAutoDismissMessageOptions = {
  delay?: number;
};

const useAutoDismissMessage = (
  value: string,
  setValue: Dispatch<SetStateAction<string>>,
  options?: UseAutoDismissMessageOptions
) => {
  const delay = options?.delay ?? 3000;

  useEffect(() => {
    if (!value) {
      return;
    }

    const timer = window.setTimeout(() => {
      setValue("");
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delay, setValue, value]);
};

export default useAutoDismissMessage;
