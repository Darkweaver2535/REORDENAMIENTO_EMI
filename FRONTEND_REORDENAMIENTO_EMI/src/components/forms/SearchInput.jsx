import { Search } from "lucide-react";

function SearchInput({ value, onChange, placeholder = "Buscar...", className }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-4 top-1/2
          -translate-y-1/2 text-gray-400" size={20} />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-12 rounded-lg border border-gray-300 bg-white
          pl-12 pr-4 text-[16px] text-gray-800 font-medium outline-none transition-all
          placeholder-gray-400
          focus:border-[#002B5E] focus:ring-3 focus:ring-[#002B5E]/10"
      />
    </div>
  );
}

export default SearchInput;
