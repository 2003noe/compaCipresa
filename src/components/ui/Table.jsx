export default function Table({ columns, rows, renderCell, onRowClick, rowClassName }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                Aucun résultat
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const isClickable = Boolean(onRowClick);
              const customClass = typeof rowClassName === 'function' ? rowClassName(row) : (rowClassName || '');
              return (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`${isClickable ? 'clickable-row' : ''} ${customClass}`.trim()}
                  title={isClickable ? 'Cliquer pour afficher les détails complets' : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.align === 'right' ? 'text-right font-mono' : ''}>
                      {renderCell ? renderCell(row, c.key) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
