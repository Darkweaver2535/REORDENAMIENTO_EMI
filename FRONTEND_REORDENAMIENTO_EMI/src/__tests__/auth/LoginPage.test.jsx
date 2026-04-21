import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { LoginPage } from "../../../src/pages";
import { useAuth } from "../../../src/store/AuthContext";
import toast from "react-hot-toast";

// ── MOCKS ─────────────────────────────────────────────────────

// 1. react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

// 2. AuthContext
vi.mock("../../../src/store/AuthContext", () => ({
	useAuth: vi.fn(),
}));

// 3. react-hot-toast
vi.mock("react-hot-toast", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// ── UTILITIES ─────────────────────────────────────────────────
const renderComponent = () => {
	render(
		<BrowserRouter>
			<LoginPage />
		</BrowserRouter>
	);
};

// ── TESTS UNITARIOS ───────────────────────────────────────────
describe("LoginPage", () => {
	let mockLogin;

	beforeEach(() => {
		vi.clearAllMocks();

		// Default setup for useAuth mock
		mockLogin = vi.fn().mockResolvedValue({});
		useAuth.mockReturnValue({
			login: mockLogin,
			isAuthenticated: false,
		});
	});

	it("1. muestra error cuando el campo carnet_identidad está vacío al submit", async () => {
		renderComponent();

		// Type only the password
		const passwordInput = screen.getByPlaceholderText(/Ingrese su contraseña/i);
		await userEvent.type(passwordInput, "123456");

		// Submit
		const submitButton = screen.getByRole("button", { name: /ingresar/i });
		await userEvent.click(submitButton);

		// Assert: Error message for CI is shown
		expect(await screen.findByText(/La cédula de identidad es requerida/i)).toBeInTheDocument();
		expect(mockLogin).not.toHaveBeenCalled();
	});

	it("2. muestra error cuando el campo password está vacío al submit", async () => {
		renderComponent();

		// Type only the username
		const ciInput = screen.getByPlaceholderText(/Ingrese su carnet/i);
		await userEvent.type(ciInput, "1234567");

		// Submit
		const submitButton = screen.getByRole("button", { name: /ingresar/i });
		await userEvent.click(submitButton);

		// Assert: Error message for password is shown
		expect(await screen.findByText(/La contraseña es requerida/i)).toBeInTheDocument();
		expect(mockLogin).not.toHaveBeenCalled();
	});

	it("3. llama a auth.login con los datos correctos al hacer submit válido", async () => {
		renderComponent();

		const ciInput = screen.getByPlaceholderText(/Ingrese su carnet/i);
		const passwordInput = screen.getByPlaceholderText(/Ingrese su contraseña/i);
		const submitButton = screen.getByRole("button", { name: /ingresar/i });

		// Type valid data
		await userEvent.type(ciInput, "8888888");
		await userEvent.type(passwordInput, "password123");
		await userEvent.click(submitButton);

		// Assert: login was called with correct payload
		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalledWith({
				carnet_identidad: "8888888",
				password: "password123",
			});
		});
	});

	it("4. muestra toast de error cuando auth.login lanza una excepción", async () => {
		// Mock login to throw error
		mockLogin.mockRejectedValue(new Error("Credenciales inválidas"));
		useAuth.mockReturnValue({
			login: mockLogin,
			isAuthenticated: false,
		});

		renderComponent();

		const ciInput = screen.getByPlaceholderText(/Ingrese su carnet/i);
		const passwordInput = screen.getByPlaceholderText(/Ingrese su contraseña/i);
		const submitButton = screen.getByRole("button", { name: /ingresar/i });

		// Type valid data and submit
		await userEvent.type(ciInput, "8888888");
		await userEvent.type(passwordInput, "wrongpass");
		await userEvent.click(submitButton);

		// Assert: toast.error was called
		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Credenciales inválidas");
		});
	});

	it("5. redirige a /dashboard cuando el login es exitoso", async () => {
		renderComponent();

		const ciInput = screen.getByPlaceholderText(/Ingrese su carnet/i);
		const passwordInput = screen.getByPlaceholderText(/Ingrese su contraseña/i);
		const submitButton = screen.getByRole("button", { name: /ingresar/i });

		// Type valid data and submit
		await userEvent.type(ciInput, "8888888");
		await userEvent.type(passwordInput, "correctpass");
		await userEvent.click(submitButton);

		// Assert: navigate was called on success
		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalled();
			expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Bienvenido/i));
			expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
		});
	});
});
