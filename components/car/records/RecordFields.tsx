type RecordFieldsProps = {
  fields: ReadonlyArray<readonly [string, string | number | null | undefined]>;
};

export default function RecordFields({ fields }: RecordFieldsProps) {
  return (
    <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
      {fields.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500 max-sm:wrap-anywhere">{label}</dt>
          <dd className="wrap-anywhere whitespace-pre-wrap">
            {value === '' || value == null ? '—' : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
