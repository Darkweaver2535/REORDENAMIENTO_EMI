import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ModalEvaluacionInsitu from "../../../src/components/laboratorios/ModalEvaluacionInsitu";
import { updateEvaluacionInsitu } from "../../../src/api/laboratoriosApi";
import toast from "react-hot-toast";

// ── MOCKS ─────────────────────────────────────────────────────
vi.mock("../../../src/api/laboratoriosApi", () => ({
	updateEvaluacionInsitu: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false } },
});

const renderComponent = (equipoProp) => {
	render(
		<QueryClientProvider client={queryClient}>
			<ModalEvaluacionInsitu isOpen={true} onClose={vi.fn()} equipo={equipoProp} />
		</QueryClientProvider>
	);
};

// ── TESTS ─────────────────────────────────────────────────────
describe("ModalEvaluacionInsitu", () => {
	const mockEquipo = {
		id: 1,
		codigo_activo: "EQ-001",
		nombre: "Microscopio",
		cantidad_total: 10,
		buenas: 0,
		regulares: 0,
		malas: 0,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("1. el botón Guardar está deshabilitado cuando la suma de cantidades no coincide con el total", async () => {
		renderComponent(mockEquipo);

		const inputBuenas = screen.getByLabelText(/Buenas/i);
		const btnGuardar = screen.getByRole("button", { name: /Guardar evaluación/i });

		await userEvent.clear(inputBuenas);
		await userEvent.type(inputBuenas, "5"); 
		// Total Evaluado = 5, Total Registrado = 10 (discrepancia)

		expect(btnGuardar).toBeDisabled();
	});

	it("2. el botón Guardar se habilita cuando la suma es exacta", async () => {
		renderComponent(mockEquipo);

		const inputBuenas = screen.getByLabelText(/Buenas/i);
		const inputRegulares = screen.getByLabelText(/Regulares/i);
		const inputMalas = screen.getByLabelText(/Malas/i);
		const btnGuardar = screen.getByRole("button", { name: /Guardar evaluación/i });

		await userEvent.clear(inputBuenas);
		await userEvent.type(inputBuenas, "8");

		await userEvent.clear(inputRegulares);
		await userEvent.type(inputRegulares, "1");

		await userEvent.clear(inputMalas);
		await userEvent.type(inputMalas, "1");

		// Total Evaluado = 10, Total Registrado = 10 (coincide)
		expect(btnGuardar).not.toBeDisabled();
	});

	it("3. muestra el mensaje de error de suma en tiempo real", async () => {
		renderComponent(mockEquipo);

		const inputBuenas = screen.getByLabelText(/Buenas/i);
		await userEvent.clear(inputBuenas);
		await userEvent.type(inputBuenas, "11"); // Más del total

		expect(await screen.findByText(/El total no coincide con el registrado/i)).toBeInTheDocument();
		expect(screen.getByText(/Hay 1 unidades de más/i)).toBeInTheDocument();
	});

	it("4. llama al endpoint correcto al hacer submit con datos válidos", async () => {
		updateEvaluacionInsitu.mockResolvedValue({});
		renderComponent(mockEquipo);

		const inputBuenas = screen.getByLabelText(/Buenas/i);
		const inputRegulares = screen.getByLabelText(/Regulares/i);
		const btnGuardar = screen.getByRole("button", { name: /Guardar evaluación/i });

		await userEvent.clear(inputBuenas);
		await userEvent.type(inputBuenas, "8");

		await userEvent.clear(inputRegulares);
		await userEvent.type(inputRegulares, "2");
		
		await userEvent.click(btnGuardar);

		await waitFor(() => {
			expect(updateEvaluacionInsitu).toHaveBeenCalledWith(1, {
				buenas: 8,
				regulares: 2,
				malas: 0,
				ubicacion_exacta: "",
				observaciones: "",
				cantidad_total: 10,
			});
			expect(toast.success).toHaveBeenCalledWith("Evaluación registrada correctamente");
		});
	});
});
