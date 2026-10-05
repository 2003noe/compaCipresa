export default function Table({ columns, rows, renderCell }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-row">Aucun résultat</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map(c => (
                  <td key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                    {renderCell ? renderCell(row, c.key) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
