// src/components/layout/NotificationBell.jsx
import { useState, useRef, useEffect } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { useNotifications } from "../../store";

// Helper para tiempo relativo
const timeAgo = (dateStr) => {
	if (!dateStr) return "hace un momento";
	const date = new Date(dateStr);
	const seconds = Math.floor((new Date() - date) / 1000);

	let interval = Math.floor(seconds / (3600 * 24 * 30 * 12));
	if (interval >= 1) return `hace ${interval} año${interval === 1 ? "" : "s"}`;
	interval = Math.floor(seconds / (3600 * 24 * 30));
	if (interval >= 1) return `hace ${interval} mes${interval === 1 ? "" : "es"}`;
	interval = Math.floor(seconds / (3600 * 24));
	if (interval >= 1) return `hace ${interval} día${interval === 1 ? "" : "s"}`;
	interval = Math.floor(seconds / 3600);
	if (interval >= 1) return `hace ${interval} hora${interval === 1 ? "" : "s"}`;
	interval = Math.floor(seconds / 60);
	if (interval >= 1) return `hace ${interval} min`;
	return "hace un momento";
};

export default function NotificationBell() {
	const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);
	const buttonRef = useRef(null);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target) &&
				buttonRef.current &&
				!buttonRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleNotificationClick = async (id) => {
		if (!id) return;
		await markAsRead(id);
	};

	return (
		<div style={{ position: "relative" }}>
			{/* Botón de campana */}
			<button
				ref={buttonRef}
				onClick={() => setIsOpen(!isOpen)}
				style={{
					display: "flex", alignItems: "center", justifyContent: "center",
					width: "40px", height: "40px", borderRadius: "50%",
					backgroundColor: isOpen ? "#f3f4f6" : "transparent",
					border: "none", cursor: "pointer", position: "relative",
					transition: "background-color 200ms ease",
				}}
				className="hover:bg-gray-100"
			>
				<Bell size={20} color="#374151" />
				{unreadCount > 0 && (
					<span style={{
						position: "absolute", top: "2px", right: "2px",
						backgroundColor: "#ef4444", color: "#fff",
						fontSize: "10px", fontWeight: 800,
						minWidth: "18px", height: "18px", borderRadius: "9px",
						display: "flex", alignItems: "center", justifyContent: "center",
						padding: "0 4px", border: "2px solid #fff",
					}}>
						{unreadCount > 99 ? "99+" : unreadCount}
					</span>
				)}
			</button>

			{/* Dropdown de notificaciones */}
			{isOpen && (
				<div
					ref={dropdownRef}
					style={{
						position: "absolute", top: "calc(100% + 8px)", right: 0,
						width: "360px", backgroundColor: "#fff",
						borderRadius: "12px", border: "1px solid #e5e7eb",
						boxShadow: "0 10px 25px rgba(0,0,0,0.1)", zIndex: 50,
						display: "flex", flexDirection: "column", overflow: "hidden",
					}}
				>
					{/* Header del dropdown */}
					<div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<h3 style={{ fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 }}>Notificaciones</h3>
						{unreadCount > 0 && (
							<span style={{ fontSize: "12px", fontWeight: 700, color: "#002B5E", backgroundColor: "#EFF6FF", padding: "3px 8px", borderRadius: "10px" }}>
								{unreadCount} nuevas
							</span>
						)}
					</div>

					{/* Lista de notificaciones */}
					<div style={{ maxHeight: "360px", overflowY: "auto" }}>
						{notifications.length === 0 ? (
							<div style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af" }}>
								<div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
									<Bell size={24} color="#d1d5db" />
								</div>
								<p style={{ fontSize: "14px", fontWeight: 600, color: "#6b7280", margin: 0 }}>Estás al día</p>
								<p style={{ fontSize: "13px", fontWeight: 500, color: "#9ca3af", margin: "4px 0 0 0" }}>No tienes notificaciones nuevas.</p>
							</div>
						) : (
							<div style={{ display: "flex", flexDirection: "column" }}>
								{notifications.map((notif, index) => {
									const id = notif?.id ?? notif?.uuid;
									// Acomodar los campos según lo que devuelva el backend
									const title = notif?.titulo ?? notif?.title ?? "Notificación";
									const message = notif?.mensaje ?? notif?.message ?? "";
									const date = notif?.fecha_creacion ?? notif?.created_at;
									const isUnread = notif?.leida === false || notif?.is_read === false || true; // Asumir no leídas si vienen de getUnread

									return (
										<button
											key={id ?? index}
											onClick={() => handleNotificationClick(id)}
											style={{
												display: "flex", alignItems: "flex-start", gap: "12px",
												padding: "16px 20px", border: "none", borderBottom: "1px solid #f3f4f6",
												backgroundColor: isUnread ? "#f8fafc" : "#fff",
												cursor: "pointer", textAlign: "left", width: "100%",
												transition: "background-color 150ms ease",
											}}
											className="hover:bg-gray-50"
										>
											{/* Indicador de no leída */}
											<div style={{ flexShrink: 0, marginTop: "6px" }}>
												<div style={{
													width: "8px", height: "8px", borderRadius: "50%",
													backgroundColor: isUnread ? "#0d9488" : "transparent"
												}} />
											</div>

											<div style={{ flex: 1, minWidth: 0 }}>
												<p style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "0 0 4px 0", lineHeight: 1.3 }}>{title}</p>
												<p style={{ fontSize: "13px", fontWeight: 500, color: "#4b5563", margin: "0 0 6px 0", lineHeight: 1.4 }}>{message}</p>
												<p style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", margin: 0 }}>{timeAgo(date)}</p>
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* Footer del dropdown */}
					<div style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6", backgroundColor: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<button
							onClick={markAllAsRead}
							disabled={unreadCount === 0}
							style={{
								display: "inline-flex", alignItems: "center", gap: "6px",
								background: "none", border: "none",
								fontSize: "13px", fontWeight: 700,
								color: unreadCount === 0 ? "#d1d5db" : "#6b7280",
								cursor: unreadCount === 0 ? "not-allowed" : "pointer",
								transition: "color 150ms ease",
							}}
							className={unreadCount > 0 ? "hover:text-gray-900" : ""}
						>
							<CheckCircle2 size={15} />
							Marcar todas como leídas
						</button>
						{/* Esto puede ser un Link o botón a página completa si existe */}
						<span style={{ fontSize: "13px", fontWeight: 700, color: "#002B5E", cursor: "pointer" }} className="hover:underline">
							Ver todas
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
