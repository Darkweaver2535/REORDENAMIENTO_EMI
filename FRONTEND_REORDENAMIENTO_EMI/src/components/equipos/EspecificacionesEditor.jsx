import { useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";

/**
 * Dynamic key-value editor for equipment specifications.
 * @param {{ value: object, onChange: (obj: object) => void, readOnly: boolean }} props
 */
export default function EspecificacionesEditor({ value = {}, onChange, readOnly = false }) {
	const [specs, setSpecs] = useState(() =>
		Object.entries(value || {}).map(([clave, valor]) => ({
			id: Date.now() + Math.random(),
			clave,
			valor: String(valor),
		}))
	);

	const sync = (newSpecs) => {
		setSpecs(newSpecs);
		if (onChange) {
			const obj = Object.fromEntries(
				newSpecs.filter((s) => s.clave.trim()).map((s) => [s.clave.trim(), s.valor.trim()])
			);
			onChange(obj);
		}
	};

	const add = () => sync([...specs, { id: Date.now(), clave: "", valor: "" }]);
	const remove = (id) => sync(specs.filter((s) => s.id !== id));
	const update = (id, field, val) =>
		sync(specs.map((s) => (s.id === id ? { ...s, [field]: val } : s)));

	const inputStyle = {
		width: "100%",
		height: 42,
		borderRadius: 8,
		border: "1px solid #d1d5db",
		padding: "0 12px",
		fontSize: 14,
		fontWeight: 500,
		color: "#111827",
		backgroundColor: readOnly ? "#f9fafb" : "#fff",
		outline: "none",
	};

	return (
		<div
			style={{
				backgroundColor: "#fff",
				border: "1px solid #e5e7eb",
				borderRadius: 14,
				overflow: "hidden",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "14px 20px",
					borderBottom: "1px solid #f3f4f6",
					backgroundColor: "#fafafa",
				}}
			>
				<Wrench size={17} color="#002B5E" />
				<h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>
					Especificaciones Técnicas
				</h3>
			</div>

			<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
				{specs.length === 0 && (
					<p style={{ fontSize: 14, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>
						Sin especificaciones. {!readOnly && "Agrega una haciendo clic en el botón."}
					</p>
				)}

				{specs.map((s) => (
					<div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
						<input
							type="text"
							placeholder="Característica"
							value={s.clave}
							onChange={(e) => update(s.id, "clave", e.target.value)}
							readOnly={readOnly}
							style={{ ...inputStyle, flex: 1 }}
						/>
						<input
							type="text"
							placeholder="Valor"
							value={s.valor}
							onChange={(e) => update(s.id, "valor", e.target.value)}
							readOnly={readOnly}
							style={{ ...inputStyle, flex: 1 }}
						/>
						{!readOnly && (
							<button
								type="button"
								onClick={() => remove(s.id)}
								style={{
									width: 38,
									height: 38,
									borderRadius: 8,
									border: "1px solid #fecaca",
									backgroundColor: "#fef2f2",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									cursor: "pointer",
									flexShrink: 0,
								}}
							>
								<Trash2 size={15} color="#ef4444" />
							</button>
						)}
					</div>
				))}

				{!readOnly && (
					<button
						type="button"
						onClick={add}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							padding: "10px 16px",
							borderRadius: 8,
							border: "1px dashed #d1d5db",
							backgroundColor: "#fff",
							color: "#6b7280",
							fontSize: 14,
							fontWeight: 600,
							cursor: "pointer",
							alignSelf: "flex-start",
							marginTop: 4,
						}}
					>
						<Plus size={15} />
						Agregar especificación
					</button>
				)}
			</div>
		</div>
	);
}
