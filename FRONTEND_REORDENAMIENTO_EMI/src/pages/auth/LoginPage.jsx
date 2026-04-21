// src/pages/auth/LoginPage.jsx — Estilo ZEUS corregido
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, GraduationCap, IdCard, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { useAuth } from "../../store";

const loginSchema = z.object({
    carnet_identidad: z.string().min(5, "El carnet debe tener al menos 5 caracteres").max(20, "Máximo 20 caracteres"),
    password: z.string().min(1, "La contraseña es obligatoria"),
});

function LoginPage() {
    const navigate = useNavigate();
    const auth = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { carnet_identidad: "", password: "" },
    });

    const onSubmit = async (values) => {
        setSubmitError("");
        try {
            await auth.login(values.carnet_identidad, values.password);
            navigate("/dashboard", { replace: true });
        } catch (error) {
            const status = error?.response?.status;
            const message = status === 400 || status === 401
                ? "Credenciales incorrectas. Verifica tu CI y contraseña."
                : "Error de conexión con el servidor SAGA.";
            setSubmitError(message);
            toast.error(message);
        }
    };

    return (
        <div
            style={{
                backgroundColor: "#002B5E",
                backgroundImage: "linear-gradient(rgba(0, 43, 94, 0.7), rgba(0, 43, 94, 0.7)), url('/imagenes/fondo.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat"
            }}
            className="min-h-screen flex items-center justify-center px-6 py-10"
        >
            <div className="w-full max-w-[440px]">

                {/* ═══ Tarjeta principal ═══ */}
                <div
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
                    }}
                >
                    {/* Mini tarjeta de título */}
                    <div style={{ padding: "40px 40px 0 40px" }}>
                        <div
                            style={{
                                backgroundColor: "#f9fafb",
                                border: "1px solid #e5e7eb",
                                borderRadius: "12px",
                                padding: "24px",
                                textAlign: "center",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                            }}
                        >
                            <div className="flex justify-center mx-auto mb-2" style={{ height: "64px" }}>
                                <img src="/imagenes/emi_logo.png" alt="Logo EMI" style={{ width: "auto", height: "100%", objectFit: "contain" }} />
                            </div>
                            <p style={{ fontSize: "19px", fontWeight: 800, color: "#1f2937", marginTop: "12px", letterSpacing: "-0.01em" }}>
                                Sistema de Gestión de Laboratorios
                            </p>
                            <p style={{ fontSize: "15px", fontWeight: 500, color: "#6b7280", marginTop: "4px" }}>
                                Escuela Militar de Ingeniería — Bolivia
                            </p>
                        </div>
                    </div>

                    {/* ═══ Formulario ═══ */}
                    <div style={{ padding: "32px 40px 40px 40px" }}>
                        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>

                            {/* Carnet de Identidad */}
                            <div>
                                <label
                                    htmlFor="carnet_identidad"
                                    style={{ fontSize: "15px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "10px" }}
                                >
                                    Carnet de Identidad:
                                </label>
                                <div style={{ position: "relative" }}>
                                    <div style={{
                                        position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
                                        pointerEvents: "none", display: "flex", alignItems: "center"
                                    }}>
                                        <IdCard size={20} color="#9ca3af" />
                                    </div>
                                    <input
                                        id="carnet_identidad"
                                        type="text"
                                        placeholder="Ingrese su carnet de identidad"
                                        autoComplete="username"
                                        style={{
                                            width: "100%",
                                            height: "50px",
                                            borderRadius: "8px",
                                            border: errors.carnet_identidad ? "2px solid #f87171" : "1px solid #d1d5db",
                                            backgroundColor: "#ffffff",
                                            fontSize: "16px",
                                            fontWeight: 500,
                                            color: "#111827",
                                            paddingLeft: "48px",
                                            paddingRight: "16px",
                                            outline: "none",
                                        }}
                                        {...register("carnet_identidad")}
                                    />
                                </div>
                                {errors.carnet_identidad && (
                                    <p style={{ marginTop: "8px", fontSize: "14px", color: "#dc2626", fontWeight: 600 }}>
                                        {errors.carnet_identidad.message}
                                    </p>
                                )}
                            </div>

                            {/* Contraseña */}
                            <div>
                                <label
                                    htmlFor="password"
                                    style={{ fontSize: "15px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "10px" }}
                                >
                                    Contraseña:
                                </label>
                                <div style={{ position: "relative" }}>
                                    <div style={{
                                        position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
                                        pointerEvents: "none", display: "flex", alignItems: "center"
                                    }}>
                                        <Lock size={20} color="#9ca3af" />
                                    </div>
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Ingrese su contraseña"
                                        autoComplete="current-password"
                                        style={{
                                            width: "100%",
                                            height: "50px",
                                            borderRadius: "8px",
                                            border: errors.password ? "2px solid #f87171" : "1px solid #d1d5db",
                                            backgroundColor: "#ffffff",
                                            fontSize: "16px",
                                            fontWeight: 500,
                                            color: "#111827",
                                            paddingLeft: "48px",
                                            paddingRight: "56px",
                                            outline: "none",
                                        }}
                                        {...register("password")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((p) => !p)}
                                        style={{
                                            position: "absolute",
                                            right: "4px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "44px",
                                            height: "44px",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            border: "none",
                                        }}
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    >
                                        {showPassword
                                            ? <EyeOff size={20} color="#6b7280" />
                                            : <Eye size={20} color="#6b7280" />
                                        }
                                    </button>
                                </div>
                                {errors.password && (
                                    <p style={{ marginTop: "8px", fontSize: "14px", color: "#dc2626", fontWeight: 600 }}>
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Error */}
                            {submitError && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "12px",
                                    padding: "16px", borderRadius: "10px",
                                    backgroundColor: "#fef2f2", border: "1px solid #fecaca"
                                }}>
                                    <span style={{ fontSize: "20px", flexShrink: 0, color: "#ef4444" }}>⚠</span>
                                    <p style={{ fontSize: "15px", fontWeight: 600, color: "#b91c1c" }}>{submitError}</p>
                                </div>
                            )}

                            {/* ═══ Botón INGRESAR ═══ */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                style={{
                                    marginTop: "48px",
                                    width: "100%",
                                    height: "54px",
                                    borderRadius: "10px",
                                    backgroundColor: "#002B5E",
                                    color: "#ffffff",
                                    fontSize: "17px",
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.15em",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "10px",
                                    cursor: isSubmitting ? "not-allowed" : "pointer",
                                    opacity: isSubmitting ? 0.5 : 1,
                                    border: "none",
                                    boxShadow: "0 4px 14px rgba(0,43,94,0.4)",
                                }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <LoaderCircle size={22} color="white" className="animate-spin" />
                                        VERIFICANDO...
                                    </>
                                ) : (
                                    "INGRESAR"
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Pie */}
                <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(147,197,253,0.6)", fontWeight: 500, marginTop: "24px" }}>
                    © 2026 EMI Bolivia · SGL v1.0.0
                </p>
            </div>
        </div>
    );
}

export default LoginPage;