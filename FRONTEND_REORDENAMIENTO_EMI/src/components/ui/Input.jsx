import { forwardRef } from "react";
import { clsx } from "clsx";

const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      style={{
        width: "100%",
        height: "48px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        backgroundColor: "#ffffff",
        paddingLeft: "16px",
        paddingRight: "16px",
        fontSize: "16px",
        fontWeight: 500,
        color: "#111827",
        outline: "none",
        transition: "all 180ms ease",
      }}
      className={clsx(
        "placeholder-gray-400",
        "focus:border-[#002B5E] focus:ring-3 focus:ring-[#002B5E]/10",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-gray-100",
        className
      )}
      {...props}
    />
  );
});

export default Input;
