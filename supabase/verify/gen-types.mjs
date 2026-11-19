#!/usr/bin/env node
/**
 * Genererer lib/supabase/database.types.ts fra en Postgres-database.
 *
 * Brukes av `npm run db:types`, som bygger skjemaet fra migrasjonene på en
 * midlertidig database og leser typene derfra. Dermed trengs verken Supabase
 * CLI, Docker eller tilgang til produksjon, og typene kan aldri drive bort fra
 * migrasjonene.
 *
 * Formatet følger `supabase gen types typescript`, så supabase-js sin
 * typeinferens (inkl. innebygde relasjoner i select) virker som vanlig.
 *
 * Tilkoblingen leses fra PGHOST/PGPORT/PGUSER/PGDATABASE.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] ?? 'lib/supabase/database.types.ts';

function query(sql) {
  const out = execFileSync('psql', ['-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.trim() || 'null') ?? [];
}

const relations = query(`
  select json_agg(t order by t.name) from (
    select c.relname as name, c.relkind as kind,
      (select json_agg(json_build_object(
          'name', a.attname,
          'typname', ty.typname, 'typtype', ty.typtype, 'category', ty.typcategory,
          'elemname', ety.typname, 'elemtype', ety.typtype,
          'notnull', a.attnotnull,
          'hasdefault', (a.atthasdef or a.attidentity <> ''),
          'generated', (a.attgenerated <> '')
        ) order by a.attname)
       from pg_attribute a
       join pg_type ty on ty.oid = a.atttypid
       left join pg_type ety on ety.oid = ty.typelem and ty.typcategory = 'A'
       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
  ) t`);

const foreignKeys = query(`
  select json_agg(t order by t.table_name, t.name) from (
    select con.conname as name,
           cl.relname as table_name,
           (select json_agg(a.attname order by k.ord)
              from unnest(con.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns,
           rcl.relname as ref_table,
           (select json_agg(a.attname order by k.ord)
              from unnest(con.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_columns,
           exists (
             select 1 from pg_index i
             where i.indrelid = con.conrelid and i.indisunique and i.indpred is null
               and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
                 = (select array_agg(x order by x) from unnest(con.conkey) x)
           ) as one_to_one
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_class rcl on rcl.oid = con.confrelid
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and rcl.relnamespace = 'public'::regnamespace
  ) t`);

const enums = query(`
  select json_agg(t order by t.name) from (
    select ty.typname as name,
           (select json_agg(e.enumlabel order by e.enumsortorder)
              from pg_enum e where e.enumtypid = ty.oid) as labels
    from pg_type ty
    where ty.typnamespace = 'public'::regnamespace and ty.typtype = 'e'
  ) t`);

const functions = query(`
  select json_agg(t order by t.name) from (
    select p.proname as name, p.proretset as retset,
           rt.typname as ret_typname, rt.typtype as ret_typtype, rt.typcategory as ret_category,
           ret.typname as ret_elemname, ret.typtype as ret_elemtype,
           p.pronargdefaults as n_defaults,
           (select json_agg(json_build_object(
               'name', coalesce(p.proargnames[k.ord], 'arg' || k.ord),
               'typname', aty.typname, 'typtype', aty.typtype, 'category', aty.typcategory,
               'elemname', aety.typname, 'elemtype', aety.typtype) order by k.ord)
              from unnest(p.proargtypes::oid[]) with ordinality k(oid, ord)
              join pg_type aty on aty.oid = k.oid
              left join pg_type aety on aety.oid = aty.typelem and aty.typcategory = 'A') as args
    from pg_proc p
    join pg_type rt on rt.oid = p.prorettype
    left join pg_type ret on ret.oid = rt.typelem and rt.typcategory = 'A'
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and rt.typname <> 'trigger'
      -- Bare funksjoner som faktisk kan kalles via API-et.
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE')
           or has_function_privilege('service_role', p.oid, 'EXECUTE'))
  ) t`);

const NUMBER = new Set(['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid']);
const STRING = new Set([
  'uuid', 'text', 'varchar', 'bpchar', 'citext', 'name', 'date', 'time', 'timetz',
  'timestamp', 'timestamptz', 'interval', 'bytea', 'inet', 'cidr',
]);

function scalar(typname, typtype) {
  if (typtype === 'e') return `Database["public"]["Enums"]["${typname}"]`;
  if (typname === 'bool') return 'boolean';
  if (NUMBER.has(typname)) return 'number';
  if (STRING.has(typname)) return 'string';
  if (typname === 'json' || typname === 'jsonb') return 'Json';
  if (typname === 'void') return 'undefined';
  return 'unknown';
}

function tsType(t) {
  const { typname, typtype, category } = t;
  if (category === 'A') {
    const inner = scalar(t.elemname, t.elemtype);
    return inner.includes(' ') ? `(${inner})[]` : `${inner}[]`;
  }
  return scalar(typname, typtype);
}

const lines = [];
const out = (text = '') => lines.push(text);

out(`/**
 * GENERERT – ikke rediger for hånd.
 *
 * Regenerer etter hver skjemaendring (migrasjon):
 *   npm run db:types
 * Typene leses fra en midlertidig database bygget fra supabase/migrations,
 * så de følger migrasjonene nøyaktig. Se supabase/verify/gen-types.mjs.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Lar createClient velge riktig PostgREST-versjon for typeinferensen.
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {`);

function relationships(tableName) {
  const fks = foreignKeys.filter((fk) => fk.table_name === tableName);
  if (fks.length === 0) return '        Relationships: []';
  const body = fks.map((fk) => [
    '          {',
    `            foreignKeyName: "${fk.name}"`,
    `            columns: [${fk.columns.map((c) => `"${c}"`).join(', ')}]`,
    `            isOneToOne: ${fk.one_to_one}`,
    `            referencedRelation: "${fk.ref_table}"`,
    `            referencedColumns: [${fk.ref_columns.map((c) => `"${c}"`).join(', ')}]`,
    '          },',
  ].join('\n'));
  return ['        Relationships: [', ...body, '        ]'].join('\n');
}

out('    Tables: {');
for (const rel of relations.filter((r) => r.kind === 'r')) {
  out(`      ${rel.name}: {`);
  out('        Row: {');
  for (const col of rel.columns) {
    out(`          ${col.name}: ${tsType(col)}${col.notnull ? '' : ' | null'}`);
  }
  out('        }');
  out('        Insert: {');
  for (const col of rel.columns) {
    if (col.generated) continue;
    const optional = !col.notnull || col.hasdefault;
    out(`          ${col.name}${optional ? '?' : ''}: ${tsType(col)}${col.notnull ? '' : ' | null'}`);
  }
  out('        }');
  out('        Update: {');
  for (const col of rel.columns) {
    if (col.generated) continue;
    out(`          ${col.name}?: ${tsType(col)}${col.notnull ? '' : ' | null'}`);
  }
  out('        }');
  out(relationships(rel.name));
  out('      }');
}
out('    }');

out('    Views: {');
for (const rel of relations.filter((r) => r.kind === 'v')) {
  out(`      ${rel.name}: {`);
  out('        Row: {');
  for (const col of rel.columns) {
    // Kolonner i et view regnes alltid som nullable, som i Supabase sin generator.
    out(`          ${col.name}: ${tsType(col)} | null`);
  }
  out('        }');
  out('        Relationships: []');
  out('      }');
}
out('    }');

out('    Functions: {');
for (const fn of functions) {
  const args = fn.args ?? [];
  const firstOptional = args.length - fn.n_defaults;
  const argText = args.length === 0
    ? 'never'
    : `{ ${args.map((a, i) => `${a.name}${i >= firstOptional ? '?' : ''}: ${tsType(a)}`).join('; ')} }`;
  let ret = tsType({
    typname: fn.ret_typname, typtype: fn.ret_typtype, category: fn.ret_category,
    elemname: fn.ret_elemname, elemtype: fn.ret_elemtype,
  });
  if (fn.retset) ret = `${ret}[]`;
  out(`      ${fn.name}: { Args: ${argText}; Returns: ${ret} }`);
}
out('    }');

out('    Enums: {');
for (const en of enums) {
  out(`      ${en.name}: ${en.labels.map((l) => `"${l}"`).join(' | ')}`);
}
out('    }');
out(`    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

/** Radtypen til en tabell eller et view: Tables<'ladders'>. */
export type Tables<
  T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]),
> = (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
`);

writeFileSync(OUT, lines.join('\n'));
console.log(`Skrev ${OUT}: ${relations.length} tabeller/view, ${functions.length} funksjoner, ${enums.length} enumer.`);
