import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Estado de filtros guardado na query string (?chave=valor), compartilhado por várias páginas.
 *  - usa replace (não empilha histórico a cada tecla/clique);
 *  - omite da URL os valores iguais ao padrão (ex.: page=1&size=30 não aparecem);
 *  - preserva os demais parâmetros (clubIds, etc.);
 *  - várias atualizações no mesmo tick não se atropelam (usa o último valor, não o do render).
 */
export type UrlPatch = Record<string, string | number | boolean | null | undefined>;

export function useUrlParams(): readonly [URLSearchParams, (patch: UrlPatch) => void] {
    const [searchParams, setSearchParams] = useSearchParams();
    const latest = useRef(searchParams);
    latest.current = searchParams;

    const update = useCallback(
        (patch: UrlPatch) => {
            const next = new URLSearchParams(latest.current);
            for (const [k, v] of Object.entries(patch)) {
                if (v === null || v === undefined || v === "") next.delete(k);
                else next.set(k, String(v));
            }
            if (next.toString() === latest.current.toString()) return;
            latest.current = next; // próximas chamadas no mesmo tick partem deste valor
            setSearchParams(next, { replace: true });
        },
        [setSearchParams]
    );

    return [searchParams, update] as const;
}

type Codec<T> = {
    parse: (raw: string) => T | undefined;
    serialize: (value: T) => string;
};

function inferCodec<T>(defaultValue: T): Codec<T> {
    if (typeof defaultValue === "number") {
        return {
            parse: (raw) => {
                const n = Number(raw);
                return (Number.isFinite(n) ? n : undefined) as T | undefined;
            },
            serialize: (v) => String(v),
        };
    }
    if (typeof defaultValue === "boolean") {
        return {
            parse: (raw) => (raw === "1" || raw === "true" ? true : raw === "0" || raw === "false" ? false : undefined) as T | undefined,
            serialize: (v) => (v ? "1" : "0"),
        };
    }
    return { parse: (raw) => raw as unknown as T, serialize: (v) => String(v) };
}

type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;

function useUrlValue<V extends string | number | boolean>(
    key: string,
    defaultValue: V,
    validate?: (value: V) => boolean
): readonly [V, (next: V | ((prev: V) => V)) => void] {
    const [params, update] = useUrlParams();
    const codec = useMemo(() => inferCodec<V>(defaultValue), [defaultValue]);

    const raw = params.get(key);
    const value = useMemo<V>(() => {
        if (raw === null) return defaultValue;
        const parsed = codec.parse(raw);
        if (parsed === undefined || (validate && !validate(parsed))) return defaultValue;
        return parsed;
    }, [raw, defaultValue, codec, validate]);

    const valueRef = useRef(value);
    valueRef.current = value;

    const set = useCallback(
        (next: V | ((prev: V) => V)) => {
            const resolved = typeof next === "function" ? (next as (prev: V) => V)(valueRef.current) : next;
            valueRef.current = resolved;
            update({ [key]: resolved === defaultValue ? null : codec.serialize(resolved) });
        },
        [update, key, defaultValue, codec]
    );

    return [value, set] as const;
}

/**
 * Um parâmetro da URL com valor tipado (string, número ou booleano, conforme o padrão).
 * `validate` rejeita valores inválidos vindos de links antigos/editados à mão (volta ao padrão).
 */
export function useUrlState<T extends string | number | boolean>(
    key: string,
    defaultValue: T,
    options?: { validate?: (value: Widen<T>) => boolean }
) {
    return useUrlValue<Widen<T>>(key, defaultValue as Widen<T>, options?.validate);
}

/** Parâmetro da URL que só aceita um conjunto fixo de valores (ex.: "asc" | "desc"). */
export function useUrlEnum<T extends string>(key: string, defaultValue: T, values: readonly T[]) {
    const validate = useCallback((v: string) => (values as readonly string[]).includes(v), [values]);
    const [value, set] = useUrlValue<string>(key, defaultValue, validate);
    return [value as T, set as (next: T | ((prev: T) => T)) => void] as const;
}
