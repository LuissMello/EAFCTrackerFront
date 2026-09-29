// src/utils/paged.ts — normalização de payload paginado (paged vs array; camelCase vs PascalCase)

export type PagedLike<T> = {
  items?: T[];
  Items?: T[];
  totalCount?: number;
  TotalCount?: number;
  totalPages?: number;
  TotalPages?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
  hasNext?: boolean;
  HasNext?: boolean;
  hasPrevious?: boolean;
  HasPrevious?: boolean;
};

export function coercePaged<T>(data: any): {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  isPaged: boolean;
} {
  if (Array.isArray(data)) {
    const items = data as T[];
    return {
      items,
      page: 1,
      pageSize: items.length,
      totalCount: items.length,
      totalPages: items.length ? 1 : 0,
      hasNext: false,
      hasPrevious: false,
      isPaged: false,
    };
  }
  const obj = (data ?? {}) as PagedLike<T>;
  const items = (obj.items ?? obj.Items ?? []) as T[];

  const alt = data?.data ?? data?.Data;
  const finalItems = Array.isArray(items) && items.length ? items : Array.isArray(alt) ? (alt as T[]) : [];

  const page = obj.page ?? obj.Page ?? 1;
  const pageSize = obj.pageSize ?? obj.PageSize ?? finalItems.length;
  const totalCount = obj.totalCount ?? obj.TotalCount ?? finalItems.length;
  const totalPages = obj.totalPages ?? obj.TotalPages ?? (finalItems.length ? 1 : 0);
  const hasNext = obj.hasNext ?? obj.HasNext ?? page < totalPages;
  const hasPrevious = obj.hasPrevious ?? obj.HasPrevious ?? page > 1;

  const isPaged = !!(obj.items ?? obj.Items ?? alt);

  return { items: finalItems, page, pageSize, totalCount, totalPages, hasNext, hasPrevious, isPaged };
}
