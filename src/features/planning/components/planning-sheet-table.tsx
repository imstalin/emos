"use client";

import type { PlanningCellValue, PlanningSheet } from "@/domain/types/planning";

interface PlanningSheetTableProps {
  sheet: PlanningSheet;
  onChange: (rows: PlanningCellValue[][]) => void;
  readOnly?: boolean;
}

export function PlanningSheetTable({
  sheet,
  onChange,
  readOnly = false,
}: PlanningSheetTableProps) {
  const columnCount = Math.max(
    sheet.headers.length,
    sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
  );

  const headers =
    columnCount > sheet.headers.length
      ? [
          ...sheet.headers,
          ...Array.from(
            { length: columnCount - sheet.headers.length },
            (_, index) => `Column ${sheet.headers.length + index + 1}`,
          ),
        ]
      : sheet.headers;

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    const rows = sheet.rows.map((row, rowIdx) => {
      if (rowIdx !== rowIndex) return [...row];
      const nextRow = [...row];
      while (nextRow.length < columnCount) nextRow.push(null);
      const trimmed = value.trim();
      if (trimmed === "") {
        nextRow[colIndex] = null;
      } else if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
        nextRow[colIndex] = Number(trimmed);
      } else {
        nextRow[colIndex] = value;
      }
      return nextRow;
    });
    onChange(rows);
  }

  if (columnCount === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        This sheet is empty.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-[#4472C4] text-left text-white">
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="border border-[#D9D9D9] px-3 py-2 font-semibold whitespace-nowrap"
              >
                {header || `Col ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/40">
              {Array.from({ length: columnCount }, (_, colIndex) => {
                const value = row[colIndex];
                const display =
                  value === null || value === undefined ? "" : String(value);

                return (
                  <td
                    key={colIndex}
                    className="border border-[#E8E8E8] align-top"
                  >
                    {readOnly ? (
                      <div className="max-w-md px-3 py-2 whitespace-pre-wrap">
                        {display}
                      </div>
                    ) : (
                      <textarea
                        value={display}
                        onChange={(event) =>
                          updateCell(rowIndex, colIndex, event.target.value)
                        }
                        rows={Math.min(4, Math.max(1, display.split("\n").length))}
                        className="min-h-9 w-full min-w-[8rem] resize-y bg-transparent px-3 py-2 outline-none focus:bg-background"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
