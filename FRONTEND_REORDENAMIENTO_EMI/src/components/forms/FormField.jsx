function FormField({ label, error, htmlFor, children, required = false }) {
  return (
    <div className="space-y-2">
      <label className="block text-[14px] font-bold text-gray-700" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-[14px] text-red-600 font-semibold">{error}</p> : null}
    </div>
  );
}

export default FormField;
