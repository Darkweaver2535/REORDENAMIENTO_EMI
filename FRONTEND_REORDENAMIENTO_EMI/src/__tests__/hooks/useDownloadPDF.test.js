import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDownloadPDF from "../../../src/hooks/useDownloadPDF";
import { httpClient } from "../../../src/api";
import toast from "react-hot-toast";

// ── MOCKS ─────────────────────────────────────────────────────
vi.mock("../../../src/api", () => ({
	httpClient: {
		get: vi.fn(),
	},
}));

vi.mock("react-hot-toast", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock URL and DOM methods
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("useDownloadPDF", () => {
	let mockCreateObjectURL;
	let mockRevokeObjectURL;
	let mockClick;
	let mockRemove;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock URL
		mockCreateObjectURL = vi.fn().mockReturnValue("blob:mocked-url");
		mockRevokeObjectURL = vi.fn();
		URL.createObjectURL = mockCreateObjectURL;
		URL.revokeObjectURL = mockRevokeObjectURL;

		// Mock anchor element
		mockClick = vi.fn();
		mockRemove = vi.fn();
		vi.spyOn(document, "createElement").mockImplementation((tagName) => {
			if (tagName === "a") {
				return {
					href: "",
					download: "",
					click: mockClick,
					remove: mockRemove,
				};
			}
			return document.createElementBase(tagName); // Not quite standard but works for mocking
		});
	});

	afterEach(() => {
		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
		vi.restoreAllMocks();
	});

	it("1. isDownloading es false por defecto", () => {
		const { result } = renderHook(() => useDownloadPDF());
		expect(result.current.isDownloading).toBe(false);
	});

	it("2. isDownloading es true durante la descarga", async () => {
		// Mock a delayed response
		httpClient.get.mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({ data: new Blob() }), 100))
		);

		const { result } = renderHook(() => useDownloadPDF());

		let downloadPromise;
		act(() => {
			downloadPromise = result.current.downloadPDF("/api/test", "test.pdf");
		});

		// While downloading, should be true
		expect(result.current.isDownloading).toBe(true);

		await act(async () => {
			await downloadPromise;
		});

		// After download, should be false
		expect(result.current.isDownloading).toBe(false);
	});

	it("3. crea y hace click en un link de descarga al recibir el blob", async () => {
		const fakeBlob = new Blob(["test"], { type: "application/pdf" });
		httpClient.get.mockResolvedValue({ data: fakeBlob });

		const { result } = renderHook(() => useDownloadPDF());

		await act(async () => {
			await result.current.downloadPDF("/api/test", "report.pdf");
		});

		expect(httpClient.get).toHaveBeenCalledWith("/api/test", { responseType: "blob" });
		expect(mockCreateObjectURL).toHaveBeenCalledWith(fakeBlob);
		expect(mockClick).toHaveBeenCalled();
	});

	it("4. revoca el object URL después de la descarga", async () => {
		httpClient.get.mockResolvedValue({ data: new Blob() });

		const { result } = renderHook(() => useDownloadPDF());

		await act(async () => {
			await result.current.downloadPDF("/api/test", "report.pdf");
		});

		expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mocked-url");
	});

	it("5. llama toast.error si el endpoint falla", async () => {
		httpClient.get.mockRejectedValue(new Error("Server error"));

		const { result } = renderHook(() => useDownloadPDF());

		await act(async () => {
			await result.current.downloadPDF("/api/error", "error.pdf");
		});

		expect(toast.error).toHaveBeenCalledWith("Error al generar el reporte");
		expect(result.current.isDownloading).toBe(false);
	});
});
