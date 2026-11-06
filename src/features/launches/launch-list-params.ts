import type { ActivitiesQuery, ActivitySort, SortOrder } from '../../api/activities';

export type LaunchSortParam = 'nombre' | 'fecha' | 'precio';

export type LaunchListParams = {
  query: string;
  sort: LaunchSortParam;
  order: SortOrder;
};

const DEFAULT_LAUNCH_SORT: LaunchSortParam = 'fecha';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

const QUERY_PARAM = 'q';
const SORT_PARAM = 'orden';
const ORDER_PARAM = 'dir';

const API_SORT_BY_PARAM: Record<LaunchSortParam, ActivitySort> = {
  nombre: 'name',
  fecha: 'date',
  precio: 'price',
};

export function isLaunchSortParam(value: string | null): value is LaunchSortParam {
  return value === 'nombre' || value === 'fecha' || value === 'precio';
}

export function isSortOrder(value: string | null): value is SortOrder {
  return value === 'asc' || value === 'desc';
}

export function parseLaunchListParams(searchParams: URLSearchParams): LaunchListParams {
  const sort = searchParams.get(SORT_PARAM);
  const order = searchParams.get(ORDER_PARAM);
  return {
    query: (searchParams.get(QUERY_PARAM) ?? '').trim(),
    sort: isLaunchSortParam(sort) ? sort : DEFAULT_LAUNCH_SORT,
    order: isSortOrder(order) ? order : DEFAULT_SORT_ORDER,
  };
}

export function toActivitiesQuery({ query, sort, order }: LaunchListParams): ActivitiesQuery {
  const activitiesQuery: ActivitiesQuery = { sort: API_SORT_BY_PARAM[sort], order };
  if (query !== '') {
    activitiesQuery.q = query;
  }
  return activitiesQuery;
}

function setTrimmedQuery(searchParams: URLSearchParams, text: string | null): void {
  const query = (text ?? '').trim();
  if (query !== '') {
    searchParams.set(QUERY_PARAM, query);
  }
}

export function withQuery(searchParams: URLSearchParams, text: string): URLSearchParams {
  const next = new URLSearchParams();
  setTrimmedQuery(next, text);
  const sort = searchParams.get(SORT_PARAM);
  if (isLaunchSortParam(sort)) {
    next.set(SORT_PARAM, sort);
  }
  const order = searchParams.get(ORDER_PARAM);
  if (isSortOrder(order)) {
    next.set(ORDER_PARAM, order);
  }
  return next;
}

export function withSort(
  searchParams: URLSearchParams,
  sort: LaunchSortParam,
  order: SortOrder,
): URLSearchParams {
  const next = new URLSearchParams();
  setTrimmedQuery(next, searchParams.get(QUERY_PARAM));
  next.set(SORT_PARAM, sort);
  next.set(ORDER_PARAM, order);
  return next;
}
