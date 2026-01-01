declare module "qpdf-wasm" {
	interface QpdfModule {
		FS: {
			mkdir: (path: string) => void;
			writeFile: (path: string, data: Uint8Array) => void;
			readFile: (path: string) => Uint8Array;
			unlink: (path: string) => void;
		};
		callMain: (args: string[]) => number;
	}

	function init(): Promise<QpdfModule>;
	export default init;
}
