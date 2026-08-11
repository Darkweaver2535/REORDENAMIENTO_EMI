// src/pages/auth/LoginPage.jsx — Identidad Corporativa EMI 2025
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, IdCard, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { useAuth } from "../../store";
import { EmiLogo } from "../../components/ui";

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
                backgroundColor: "#003D7C",
                backgroundImage: "linear-gradient(rgba(0, 61, 124, 0.86), rgba(0, 45, 92, 0.92)), url('/imagenes/fondo.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
            }}
            className="min-h-screen flex items-center justify-center px-6 py-10"
        >
            <div className="w-full max-w-[440px]">

                {/* ═══ Tarjeta principal ═══ */}
                <div
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "18px",
                        overflow: "hidden",
                        boxShadow: "0 25px 60px -12px rgba(0,0,0,0.45)",
                    }}
                >
                    {/* ── Cabecera azul institucional con castillo ── */}
                    <div
                        style={{
                            background: "linear-gradient(135deg, #004F9F 0%, #003D7C 100%)",
                            padding: "34px 40px 26px 40px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                        }}
                    >
                        <EmiLogo variant="full" theme="dark" markSize={46} subtitle="Escuela Militar de Ingeniería" />
                    </div>
                    {/* Línea amarilla de marca */}
                    <div className="emi-accent-line" style={{ width: "100%", borderRadius: 0 }} />

                    {/* ═══ Formulario ═══ */}
                    <div style={{ padding: "30px 40px 38px 40px" }}>
                        <div style={{ textAlign: "center", marginBottom: "26px" }}>
                            <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#003D7C", letterSpacing: "-0.01em" }}>
                                Sistema de Gestión de Laboratorios
                            </h1>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "#808080", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                Acceso institucional
                            </p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>

                            {/* Carnet de Identidad */}
                            <div>
                                <label
                                    htmlFor="carnet_identidad"
                                    style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A1A", display: "block", marginBottom: "10px" }}
                                >
                                    Carnet de Identidad:
                                </label>
                                <div style={{ position: "relative" }}>
                                    <div style={{
                                        position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
                                        pointerEvents: "none", display: "flex", alignItems: "center"
                                    }}>
                                        <IdCard size={20} color="#004F9F" />
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
                                            color: "#1A1A1A",
                                            paddingLeft: "48px",
                                            paddingRight: "16px",
                                            outline: "none",
                                        }}
                                        className="focus:border-[#004F9F] focus:ring-3 focus:ring-[#004F9F]/15"
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
                                    style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A1A", display: "block", marginBottom: "10px" }}
                                >
                                    Contraseña:
                                </label>
                                <div style={{ position: "relative" }}>
                                    <div style={{
                                        position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
                                        pointerEvents: "none", display: "flex", alignItems: "center"
                                    }}>
                                        <Lock size={20} color="#004F9F" />
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
                                            color: "#1A1A1A",
                                            paddingLeft: "48px",
                                            paddingRight: "56px",
                                            outline: "none",
                                        }}
                                        className="focus:border-[#004F9F] focus:ring-3 focus:ring-[#004F9F]/15"
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
                                    marginTop: "40px",
                                    width: "100%",
                                    height: "54px",
                                    borderRadius: "10px",
                                    background: "linear-gradient(135deg, #004F9F 0%, #003D7C 100%)",
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
                                    borderBottom: "3px solid #FFDD00",
                                    boxShadow: "0 6px 18px rgba(0,79,159,0.4)",
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
                <p style={{ textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: "22px", letterSpacing: "0.03em" }}>
                    © 2026 Escuela Militar de Ingeniería · Bolivia · SGL v1.4
                </p>
            </div>
        </div>
    );
}

export default LoginPage;
