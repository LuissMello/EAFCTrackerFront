import React from "react";
import { divisionCrestUrl, hideImgOnError } from "../../config/urls.ts";
import { TAG_CLS } from "./shared.ts";

/** Selo de divisão ("Div. 3", com o escudo da EA quando existir). Não renderiza nada sem valor. */
export const DivisionChip = React.memo(function DivisionChip({ label = "Div.", value }: { label?: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  const crest = divisionCrestUrl(value);
  return (
    <span className={TAG_CLS}>
      {crest && <img src={crest} alt="" className="h-4 w-4 object-contain" loading="lazy" onError={hideImgOnError} />}
      {label} {value}
    </span>
  );
});
