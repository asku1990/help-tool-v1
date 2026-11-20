type RecordFieldsProps = {
  fields: ReadonlyArray<readonly [string, string | number | null | undefined]>;
};

export default function RecordFields({ fields }: RecordFieldsProps) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {fields.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500">{label}</dt>
          <dd className="wrap-anywhere whitespace-pre-wrap">
            {value === '' || value == null ? '—' : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
