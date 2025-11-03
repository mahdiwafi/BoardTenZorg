import { useCallback, useState } from "react";

type AsyncAction<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

type AsyncState<TResult> = {
  error: string | null;
  isLoading: boolean;
  result: TResult | null;
};

type UseAsyncActionReturn<TArgs extends unknown[], TResult> = AsyncState<TResult> & {
  run: AsyncAction<TArgs, TResult>;
  reset: () => void;
};

const defaultFormatError = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred";

/**
 * Small helper hook for running async actions with loading and error state.
 * Reduces repetitive `try/catch` blocks in client components.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: AsyncAction<TArgs, TResult>,
  options?: {
    /**
     * Optional transform to massage thrown errors into plain strings.
     * Defaults to exposing the message of the thrown `Error`.
     */
    formatError?: (error: unknown) => string;
  },
): UseAsyncActionReturn<TArgs, TResult> {
  const customFormatError = options?.formatError;

  const [state, setState] = useState<AsyncState<TResult>>({
    error: null,
    isLoading: false,
    result: null,
  });

  const run = useCallback(
    async (...args: TArgs) => {
      setState((previous) => ({
        ...previous,
        error: null,
        isLoading: true,
      }));

      try {
        const result = await action(...args);
        setState({ error: null, isLoading: false, result });
        return result;
      } catch (error: unknown) {
        const normalizeError = customFormatError ?? defaultFormatError;
        const errorMessage = normalizeError(error);
        setState({ error: errorMessage, isLoading: false, result: null });
        return null;
      }
    },
    [action, customFormatError],
  );

  const reset = useCallback(() => {
    setState({ error: null, isLoading: false, result: null });
  }, []);

  return {
    ...state,
    run,
    reset,
  };
}
