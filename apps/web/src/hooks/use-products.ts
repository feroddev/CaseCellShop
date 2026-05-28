'use client';

import { useQuery } from '@tanstack/react-query';
import { listProducts } from '@/lib/api';
import { productKeys } from '@/lib/query-keys';

export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: listProducts,
  });
}
