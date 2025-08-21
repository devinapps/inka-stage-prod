import { QueryClient, type QueryFunctionContext } from "@tanstack/react-query";

// Default fetcher function that works with the backend
const defaultQueryFn = async ({ queryKey }: QueryFunctionContext) => {
  const url = queryKey[0] as string;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  
  return res.json();
};

// API request function for mutations
export const apiRequest = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  
  return res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
    },
  },
});