import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import MultiClubPicker from "./MultiClubPicker.tsx";
import { useClub } from "../hooks/useClub.tsx";

export default function Navbar() {
    const { setClub } = useClub();
    const [searchParams, setSearchParams] = useSearchParams();

    // estado local refletindo a URL (?clubIds=... ou ?clubId=...)
    const [groupIds, setGroupIds] = React.useState<number[]>(() => {
        const raw = searchParams.get("clubIds");
        if (raw) {
            const ids = raw.split(",").map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
            return ids;
        }
        const single = searchParams.get("clubId");
        if (single && !Number.isNaN(parseInt(single, 10))) return [parseInt(single, 10)];
        return [];
    });

    // mantém sincronizado caso a URL mude por fora
    React.useEffect(() => {
        const raw = searchParams.get("clubIds");
        if (raw) {
            const ids = raw.split(",").map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
            setGroupIds(ids);
            return;
        }
        const single = searchParams.get("clubId");
        if (single && !Number.isNaN(parseInt(single, 10))) setGroupIds([parseInt(single, 10)]);
        else setGroupIds([]);
    }, [searchParams]);

    // aplica seleção → URL + useClub (back-compat)
    const handleChange = (ids: number[]) => {
        setGroupIds(ids);
        const next = new URLSearchParams(searchParams);
        if (ids.length) next.set("clubIds", ids.join(",")); else next.delete("clubIds");
        if (ids.length === 1) next.set("clubId", String(ids[0])); else next.delete("clubId");
        setSearchParams(next, { replace: true });

        if (ids.length === 1) setClub({ clubId: ids[0] });
        else setClub(null);
    };

    return (
        <nav className="bg-black text-white p-4 flex flex-wrap items-center gap-3">
            <Link className="font-bold" to="/">Partidas</Link>
            <Link className="font-bold" to="/stats">Estatísticas</Link>
            <Link className="font-bold" to="/calendar">Calendário</Link>
            <Link className="font-bold" to="/trends">Trends</Link>
            <Link className="font-bold" to="/attributes">Atributos</Link>

            <div className="ml-auto flex items-center gap-2">
                <MultiClubPicker value={groupIds} onChange={handleChange} />
            </div>
        </nav>
    );
}
