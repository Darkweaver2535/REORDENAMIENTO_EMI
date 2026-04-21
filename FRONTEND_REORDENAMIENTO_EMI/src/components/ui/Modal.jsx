import { X } from "lucide-react";

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl
          animate-[modalIn_250ms_ease-out]">
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-200">
          <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg
                text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
        <div className="px-7 py-6 text-[16px] text-gray-700 leading-relaxed font-medium">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
