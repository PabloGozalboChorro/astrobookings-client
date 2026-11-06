import { describe, expect, it } from 'vitest';
import {
  parseLaunchListParams,
  toActivitiesQuery,
  withQuery,
  withSort,
  type LaunchListParams,
} from '../../../../src/features/launches/launch-list-params';

function parse(search: string): LaunchListParams {
  return parseLaunchListParams(new URLSearchParams(search));
}

describe('parseLaunchListParams', () => {
  it.each([
    ['', { query: '', sort: 'fecha', order: 'asc' }],
    ['orden=plazas&dir=arriba', { query: '', sort: 'fecha', order: 'asc' }],
    ['orden=precio&dir=arriba', { query: '', sort: 'precio', order: 'asc' }],
    ['orden=plazas&dir=desc', { query: '', sort: 'fecha', order: 'desc' }],
    ['orden=PRECIO', { query: '', sort: 'fecha', order: 'asc' }],
    ['orden=&dir=', { query: '', sort: 'fecha', order: 'asc' }],
  ])('R5/R7: parseLaunchListParams(%s) is %o', (search, expected) => {
    expect(parse(search)).toEqual(expected);
  });

  it('R6: parseLaunchListParams reads q, orden and dir', () => {
    expect(parse('q=kourou&orden=precio&dir=desc')).toEqual({
      query: 'kourou',
      sort: 'precio',
      order: 'desc',
    });
  });

  it('R2: parseLaunchListParams trims q', () => {
    expect(parse('q=%20falcon%20').query).toBe('falcon');
  });

  it('R3: whitespace-only q is empty', () => {
    expect(parse('q=%20%20%20').query).toBe('');
  });
});

describe('toActivitiesQuery', () => {
  it.each([
    ['nombre', 'name'],
    ['fecha', 'date'],
    ['precio', 'price'],
  ] as const)('R4: toActivitiesQuery maps %s to %s', (sort, apiSort) => {
    expect(toActivitiesQuery({ query: '', sort, order: 'desc' })).toEqual({
      sort: apiSort,
      order: 'desc',
    });
  });

  it('R2: toActivitiesQuery includes a non-empty query', () => {
    expect(toActivitiesQuery({ query: 'falcon', sort: 'precio', order: 'asc' })).toEqual({
      q: 'falcon',
      sort: 'price',
      order: 'asc',
    });
  });

  it('R5: toActivitiesQuery of the defaults is date ascending without q', () => {
    expect(toActivitiesQuery(parse(''))).toEqual({ sort: 'date', order: 'asc' });
  });
});

describe('withQuery', () => {
  it('R2: withQuery sets the trimmed text first and keeps a valid order', () => {
    const next = withQuery(new URLSearchParams('orden=precio&dir=desc'), ' falcon ');

    expect(next.toString()).toBe('q=falcon&orden=precio&dir=desc');
  });

  it.each(['', '   '])('R3: withQuery removes q for the text "%s"', (text) => {
    const next = withQuery(new URLSearchParams('q=falcon&orden=precio&dir=desc'), text);

    expect(next.toString()).toBe('orden=precio&dir=desc');
  });

  it('R7: withQuery drops invalid orden/dir', () => {
    const next = withQuery(new URLSearchParams('orden=plazas&dir=desc'), 'falcon');

    expect(next.toString()).toBe('q=falcon&dir=desc');
  });

  it('R2: withQuery serialises Órbita Marciana as q=%C3%93rbita+Marciana', () => {
    expect(withQuery(new URLSearchParams(), 'Órbita Marciana').toString()).toBe(
      'q=%C3%93rbita+Marciana',
    );
  });

  it('R5: withQuery on an empty URL with an empty text adds nothing', () => {
    expect(withQuery(new URLSearchParams(), '').toString()).toBe('');
  });

  it('R2: withQuery does not modify the received parameters', () => {
    const current = new URLSearchParams('orden=precio');

    withQuery(current, 'falcon');

    expect(current.toString()).toBe('orden=precio');
  });
});

describe('withSort', () => {
  it('R4: withSort keeps q and writes orden and dir', () => {
    const next = withSort(new URLSearchParams('q=falcon'), 'precio', 'desc');

    expect(next.toString()).toBe('q=falcon&orden=precio&dir=desc');
  });

  it('R4: withSort writes both values even when one is the default', () => {
    const next = withSort(new URLSearchParams(), 'nombre', 'asc');

    expect(next.toString()).toBe('orden=nombre&dir=asc');
  });

  it('R7: withSort replaces invalid values', () => {
    const next = withSort(new URLSearchParams('dir=arriba&orden=plazas&q=kourou'), 'fecha', 'desc');

    expect(next.toString()).toBe('q=kourou&orden=fecha&dir=desc');
  });

  it('R4: withSort trims q and drops it when it is only spaces', () => {
    expect(withSort(new URLSearchParams('q=%20falcon%20'), 'precio', 'asc').toString()).toBe(
      'q=falcon&orden=precio&dir=asc',
    );
    expect(withSort(new URLSearchParams('q=%20%20'), 'precio', 'asc').toString()).toBe(
      'orden=precio&dir=asc',
    );
  });
});
